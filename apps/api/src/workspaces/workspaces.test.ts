import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setOverride } from '../access/grants';
import { migrateAppSchema } from '../db/migrations';
import { Jar, ORIGIN, startApp, type TestApp } from '../testing/helpers';
import { MAX_STATE_BYTES } from './state';

const BO = { name: 'Bo', email: 'bo@example.com', password: 'another horse battery' };
const OPERATOR = { type: 'admin', id: 'operator' } as const;
const STATE = { v: 1, layers: { ships: true, flights: false }, viewport: { lat: 43.1, lng: 34.2, zoom: 5.5 }, tool: 'layers' };

let t: TestApp;
let ada: { jar: Jar; userId: string };

beforeEach(async () => {
  t = await startApp();
  ada = await person();
});
afterEach(() => t.close());

async function person(who?: typeof BO) {
  const jar = await t.signUpVerified(new Jar(), who);
  return { jar, userId: (await t.session(jar.get()))!.user.id };
}

type Auth = Jar | { key: string } | null;

function call(auth: Auth, method: string, path: string, { body, headers = {} }: { body?: unknown; headers?: Record<string, string> } = {}) {
  const credentials: Record<string, string> = auth instanceof Jar ? { cookie: auth.get() } : auth ? { authorization: `Bearer ${auth.key}` } : {};
  return t.app.request(`/api/v1${path}`, {
    method,
    headers: { origin: ORIGIN, ...credentials, ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
    ...(body !== undefined && { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });
}

type Body = { error?: string; message?: string; slug?: string; workspaces?: object[]; max?: number };
const reply = async (res: Response) => [res.status, (await res.json()) as Body] as const;
const list = async (auth: Auth) => (await reply(await call(auth, 'GET', '/workspaces')))[1];
const row = (id: string) => t.db.prepare('SELECT * FROM ws_workspace WHERE workspace_id = ?').get(id) as Record<string, unknown> | undefined;
const rows = () => t.db.prepare('SELECT count(*) FROM ws_workspace').pluck().get() as number;

async function create(auth: Auth = ada.jar, body: unknown = { name: 'Black Sea', state: STATE }) {
  const res = await call(auth, 'POST', '/workspaces', { body });
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string; rev: number };
}

function override(userId: string, key: string, value: string) {
  setOverride(t.db, { userId, key, value, actor: OPERATOR });
  t.access.invalidate();
}

/** A state whose JSON is exactly `bytes` long. */
function stateOf(bytes: number) {
  const empty = JSON.stringify({ v: 1, filters: { pad: '' } }).length;
  return { v: 1, filters: { pad: 'x'.repeat(bytes - empty) } };
}

describe('workspaces', () => {
  it('are created, listed, read, changed and soft-deleted by their owner', async () => {
    const res = await call(ada.jar, 'POST', '/workspaces', { body: { name: '  Black Sea  ', state: STATE } });
    expect(res.status).toBe(201);
    expect(res.headers.get('etag')).toBe('"1"');
    const created = (await res.json()) as { id: string };
    expect(created).toMatchObject({ name: 'Black Sea', rev: 1, visibility: 'private', shareSlug: null, state: STATE, stateVersion: 1 });
    expect(created.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(row(created.id)).toMatchObject({ owner_id: ada.userId, name: 'Black Sea', rev: 1, state_version: 1, deleted_at: null });
    expect(JSON.parse(row(created.id)!.state as string)).toEqual(STATE);

    const listed = await call(ada.jar, 'GET', '/workspaces');
    expect(listed.status).toBe(200);
    const all = (await listed.json()) as Body;
    expect(all).toEqual({ max: 5, workspaces: [expect.objectContaining({ id: created.id, name: 'Black Sea', rev: 1 })] });
    expect(all.workspaces![0]).not.toHaveProperty('state');

    const read = await call(ada.jar, 'GET', `/workspaces/${created.id}`);
    expect([read.status, read.headers.get('etag'), read.headers.get('cache-control')]).toEqual([200, '"1"', 'private, no-store']);
    expect(await read.json()).toMatchObject({ id: created.id, state: STATE });

    const moved = { ...STATE, viewport: { lat: 41, lng: 29, zoom: 9 } };
    const put = await call(ada.jar, 'PUT', `/workspaces/${created.id}`, { body: { name: 'Bosphorus', state: moved }, headers: { 'if-match': '"1"' } });
    expect([put.status, put.headers.get('etag')]).toEqual([200, '"2"']);
    expect(await put.json()).toMatchObject({ name: 'Bosphorus', rev: 2, state: moved });
    const renamed = await call(ada.jar, 'PUT', `/workspaces/${created.id}`, { body: { name: 'Straits' }, headers: { 'if-match': '2' } });
    expect(await renamed.json()).toMatchObject({ name: 'Straits', rev: 3, state: moved });
    expect(row(created.id)).toMatchObject({ name: 'Straits', rev: 3 });

    expect(await reply(await call(ada.jar, 'DELETE', `/workspaces/${created.id}`))).toEqual([200, { ok: true }]);
    expect(row(created.id)).toMatchObject({ name: 'Straits', deleted_at: expect.any(Number) });
    expect(await reply(await call(ada.jar, 'GET', `/workspaces/${created.id}`))).toEqual([404, { error: 'not_found' }]);
    expect((await call(ada.jar, 'PUT', `/workspaces/${created.id}`, { body: { name: 'x' }, headers: { 'if-match': '*' } })).status).toBe(404);
    expect((await call(ada.jar, 'DELETE', `/workspaces/${created.id}`)).status).toBe(404);
    expect((await list(ada.jar)).workspaces).toEqual([]);
  });

  it('refuse a stale If-Match with the stored rev, and overwrite on *', async () => {
    const { id } = await create();
    const put = (ifMatch: string | undefined, name: string) =>
      call(ada.jar, 'PUT', `/workspaces/${id}`, { body: { name }, headers: ifMatch === undefined ? {} : { 'if-match': ifMatch } });

    expect((await put('1', 'From the laptop')).status).toBe(200);
    const stale = await put('1', 'From the phone');
    expect([stale.status, stale.headers.get('etag'), await stale.json()]).toEqual([409, '"2"', { error: 'stale_rev', rev: 2 }]);
    expect(row(id)).toMatchObject({ name: 'From the laptop', rev: 2 });

    expect(await reply(await put(undefined, 'No header'))).toEqual([428, { error: 'if_match_required' }]);
    expect(await reply(await put('soon', 'Bad header'))).toEqual([400, { error: 'invalid_request', message: 'If-Match must be a rev or *.' }]);
    expect(await reply(await put('*', 'Autosaved'))).toEqual([200, expect.objectContaining({ name: 'Autosaved', rev: 3 })]);
    expect(row(id)).toMatchObject({ name: 'Autosaved', rev: 3 });
  });

  it('refuse a malformed name, state or body', async () => {
    const refused = async (body: unknown) => {
      const [status, json] = await reply(await call(ada.jar, 'POST', '/workspaces', { body }));
      return [status, json.error];
    };
    expect(await refused({ name: '', state: STATE })).toEqual([400, 'invalid_request']);
    expect(await refused({ name: 'x'.repeat(81), state: STATE })).toEqual([400, 'invalid_request']);
    expect(await refused({ name: 'Old', state: { ...STATE, v: 2 } })).toEqual([400, 'invalid_request']);
    expect(await refused({ name: 'Typo', state: { ...STATE, layer: {} } })).toEqual([400, 'invalid_request']);
    expect(await refused({ name: 'Off map', state: { v: 1, viewport: { lat: 91, lng: 0, zoom: 3 } } })).toEqual([400, 'invalid_request']);
    expect(await refused('{"name": "Broken",')).toEqual([400, 'invalid_request']);
    expect(rows()).toBe(0);

    const { id } = await create();
    const [status, json] = await reply(await call(ada.jar, 'PUT', `/workspaces/${id}`, { body: {}, headers: { 'if-match': '1' } }));
    expect([status, json.error, json.message]).toEqual([400, 'invalid_request', expect.stringContaining('Send a name, a state, or both.')]);
  });

  it(`hold a state of up to ${MAX_STATE_BYTES / 1024} KB`, async () => {
    const tooLarge = [413, { error: 'too_large', limit: MAX_STATE_BYTES }];
    const { id } = await create(ada.jar, { name: 'Full', state: stateOf(MAX_STATE_BYTES) });
    expect(JSON.stringify(JSON.parse(row(id)!.state as string)).length).toBe(MAX_STATE_BYTES);

    expect(await reply(await call(ada.jar, 'POST', '/workspaces', { body: { name: 'Over', state: stateOf(MAX_STATE_BYTES + 1) } }))).toEqual(tooLarge);
    expect(await reply(await call(ada.jar, 'POST', '/workspaces', { body: { name: 'Way over', state: stateOf(2 * MAX_STATE_BYTES) } }))).toEqual(tooLarge);
    expect(await reply(await call(ada.jar, 'PUT', `/workspaces/${id}`, { body: { state: stateOf(MAX_STATE_BYTES + 1) }, headers: { 'if-match': '*' } }))).toEqual(tooLarge);
    expect(rows()).toBe(1);
    expect(row(id)).toMatchObject({ rev: 1 });
  });

  it('stop at the plan\'s workspaces.max, counting only the ones not deleted', async () => {
    override(ada.userId, 'workspaces.max', '2');
    const first = await create();
    await create();
    const [status, body] = await reply(await call(ada.jar, 'POST', '/workspaces', { body: { name: 'Third', state: STATE } }));
    expect([status, body]).toEqual([403, { error: 'limit_reached', entitlement: 'workspaces.max', limit: 2, upgrade_url: '/pricing' }]);
    expect(rows()).toBe(2);

    expect((await call(ada.jar, 'DELETE', `/workspaces/${first.id}`)).status).toBe(200);
    await create(ada.jar, { name: 'Third', state: STATE });
    expect(rows()).toBe(3);
    expect((await list(ada.jar)).max).toBe(2);
  });

  it('keep visitors out and answer 404 for anyone else\'s', async () => {
    const { id } = await create();
    const bo = await person(BO);
    const before = row(id);

    for (const [method, path, body] of [
      ['GET', `/workspaces/${id}`, undefined],
      ['PUT', `/workspaces/${id}`, { name: 'Mine now' }],
      ['DELETE', `/workspaces/${id}`, undefined],
      ['POST', `/workspaces/${id}/share`, undefined],
      ['DELETE', `/workspaces/${id}/share`, undefined],
    ] as const) {
      expect(await reply(await call(bo.jar, method, path, { body, headers: { 'if-match': '*' } })), `${method} ${path}`).toEqual([404, { error: 'not_found' }]);
      expect(await reply(await call(null, method, path, { body, headers: { 'if-match': '*' } })), `${method} ${path}`).toEqual([401, { error: 'sign_in_required' }]);
    }
    expect((await list(bo.jar)).workspaces).toEqual([]);
    expect(await reply(await call(null, 'GET', '/workspaces'))).toEqual([401, { error: 'sign_in_required' }]);
    expect(row(id)).toEqual(before);
  });

  it('work with an unrestricted API key, not one limited to scopes', async () => {
    override(ada.userId, 'api.keys.max', '2');
    const newKey = async (scopes?: string[]) => {
      const res = await call(ada.jar, 'POST', '/keys', { body: { name: 'script', ...(scopes && { scopes }) } });
      expect(res.status).toBe(201);
      return { key: ((await res.json()) as { key: string }).key };
    };
    const key = await newKey();
    const { id } = await create(key);
    expect(row(id)).toMatchObject({ owner_id: ada.userId });
    expect((await call(key, 'PUT', `/workspaces/${id}`, { body: { name: 'By script' }, headers: { 'if-match': '1' } })).status).toBe(200);
    expect((await list(ada.jar)).workspaces).toEqual([expect.objectContaining({ id, name: 'By script' })]);

    const scoped = await newKey(['read:tracks']);
    expect(await reply(await call(scoped, 'GET', `/workspaces/${id}`))).toEqual([403, { error: 'insufficient_scope' }]);
    expect(await reply(await call(scoped, 'POST', '/workspaces', { body: { name: 'No', state: STATE } }))).toEqual([403, { error: 'insufficient_scope' }]);
  });
});

describe('share links', () => {
  it('open a workspace read-only with no session, without its owner or their private lists', async () => {
    const private_ = { recentPlaces: [{ label: 'Home', lat: 41.01, lng: 28.97, at: 1 }], watchlist: ['^VIX'] };
    const { id } = await create(ada.jar, { name: 'Black Sea', state: { ...STATE, ...private_ } });
    const [status, link] = await reply(await call(ada.jar, 'POST', `/workspaces/${id}/share`));
    expect([status, link]).toEqual([200, { slug: expect.stringMatching(/^[A-Za-z0-9_-]{16}$/), path: `/w/${link.slug}` }]);
    const slug = link.slug!;
    expect(row(id)).toMatchObject({ share_slug: slug, visibility: 'link', rev: 1 });

    const shared = await call(null, 'GET', `/w/${slug}`);
    expect([shared.status, shared.headers.get('cache-control')]).toEqual([200, 'no-store']);
    const text = await shared.text();
    expect(JSON.parse(text)).toEqual({ name: 'Black Sea', state: STATE, stateVersion: 1, updatedAt: expect.any(Number) });
    for (const leak of [ada.userId, 'ada@example.com', 'Home', '^VIX', id]) expect(text).not.toContain(leak);
    expect((await call(ada.jar, 'GET', `/w/${slug}`)).status).toBe(200);
  });

  it('stop working when rotated, revoked or deleted', async () => {
    const { id } = await create();
    const share = async () => ((await (await call(ada.jar, 'POST', `/workspaces/${id}/share`)).json()) as { slug: string }).slug;
    const opens = async (slug: string) => (await call(null, 'GET', `/w/${slug}`)).status;

    const first = await share();
    const second = await share();
    expect(second).not.toBe(first);
    expect([await opens(first), await opens(second)]).toEqual([404, 200]);

    expect(await reply(await call(ada.jar, 'DELETE', `/workspaces/${id}/share`))).toEqual([200, { ok: true }]);
    expect(await opens(second)).toBe(404);
    expect(row(id)).toMatchObject({ share_slug: null, visibility: 'private' });

    const third = await share();
    expect(await opens(third)).toBe(200);
    expect((await call(ada.jar, 'DELETE', `/workspaces/${id}`)).status).toBe(200);
    expect(await opens(third)).toBe(404);
    expect(row(id)).toMatchObject({ share_slug: null });
    expect(await opens('not-a-slug')).toBe(404);
  });

  it('need workspaces.share', async () => {
    const { id } = await create();
    override(ada.userId, 'workspaces.share', 'false');
    expect(await reply(await call(ada.jar, 'POST', `/workspaces/${id}/share`))).toEqual([
      403, { error: 'entitlement_required', entitlement: 'workspaces.share', upgrade_url: '/pricing' },
    ]);
    expect(row(id)).toMatchObject({ share_slug: null, visibility: 'private' });
  });
});

describe('ws_workspace migration', () => {
  it('runs again over an existing table', async () => {
    const { id } = await create();
    t.db.pragma('user_version = 7');
    migrateAppSchema(t.db);
    expect(t.db.pragma('user_version', { simple: true })).toBe(8);
    expect(row(id)).toMatchObject({ name: 'Black Sea' });
  });
});

describe('the OpenAPI spec', () => {
  it('lists the workspace routes', async () => {
    const spec = (await (await t.app.request('/api/v1/openapi.json')).json()) as { paths: Record<string, Record<string, unknown>> };
    expect(Object.keys(spec.paths['/workspaces'])).toEqual(['get', 'post']);
    expect(Object.keys(spec.paths['/workspaces/{id}'])).toEqual(['get', 'put', 'delete']);
    expect(Object.keys(spec.paths['/workspaces/{id}/share'])).toEqual(['post', 'delete']);
    expect(Object.keys(spec.paths['/w/{slug}'])).toEqual(['get']);
  });
});
