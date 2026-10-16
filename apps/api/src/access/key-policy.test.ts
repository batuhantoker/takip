import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dataLayout, openWriter, SqliteCatalogStore } from '@takip/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrateAppSchema } from '../db/migrations';
import { openReplayData, type ReplayData } from '../replay/data';
import { ORIGIN, startApp, type Jar, type TestApp } from '../testing/helpers';
import { KEY_POLICY_GROUPS, OPEN_GROUPS } from './key-policy';

// One character: the route answers no results without asking an upstream.
const SEARCH = '/api/v1/geo/search?q=a';
const ORBIT = '/api/v1/satellites/orbit';
const MANIFEST = '/api/replay/manifest';

let dir: string;
let replay: ReplayData;
let t: TestApp;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'key-policy-'));
  new SqliteCatalogStore(openWriter(dataLayout(dir).catalog, 'catalog')).db.close();
  replay = openReplayData(dir);
  t = await startApp({}, undefined, { enforceKeyPolicy: true, replay });
});

afterEach(() => {
  t.close();
  replay.close();
  rmSync(dir, { recursive: true, force: true });
});

const get = (path: string, headers: Record<string, string> = {}) => t.app.request(path, { headers });
const json = async (res: Response) => (await res.json()) as Record<string, unknown>;
const createKey = async (jar: Jar) => {
  const res = await t.app.request('/api/v1/keys', {
    method: 'POST',
    headers: { cookie: jar.get(), 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'script' }),
  });
  expect(res.status).toBe(201);
  return `Bearer ${((await res.json()) as { key: string }).key}`;
};
const refusals = () => {
  t.usage.flush();
  return t.db.prepare('SELECT route_group, SUM(requests) AS requests, SUM(denied) AS denied FROM usage_counter GROUP BY route_group ORDER BY route_group').all();
};

describe('a caller without a key', () => {
  it('is sent to a free account on an endpoint that needs a key, and counted as refused', async () => {
    const res = await get(SEARCH);
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toBe('Bearer');
    const body = await json(res);
    expect(body).toMatchObject({ error: 'api_key_required', signup_url: `${ORIGIN}/?account=sign-up`, docs_url: `${ORIGIN}/api/v1/docs` });
    expect(body.message).toContain('free account');
    expect(refusals()).toEqual([{ route_group: 'geo', requests: 0, denied: 1 }]);
  });

  it('gets through from the web app\'s own pages, not from another site or a typed URL', async () => {
    expect((await get(SEARCH, { 'sec-fetch-site': 'same-origin' })).status).toBe(200);
    expect((await get(SEARCH, { 'sec-fetch-site': 'same-site' })).status).toBe(200);
    expect((await get(SEARCH, { 'sec-fetch-site': 'cross-site' })).status).toBe(401);
    expect((await get(SEARCH, { 'sec-fetch-site': 'none' })).status).toBe(401);
  });

  it('uses the open groups as before', async () => {
    const res = await get(ORBIT);
    expect([res.status, await json(res)]).toEqual([400, { error: 'numeric NORAD id required' }]);
  });

  it('is refused on /api/replay as one group', async () => {
    expect(await json(await get(MANIFEST))).toMatchObject({ error: 'api_key_required' });
    expect((await get(MANIFEST, { 'sec-fetch-site': 'same-origin' })).status).toBe(200);
    expect(refusals()).toEqual([{ route_group: 'replay', requests: 1, denied: 1 }]);
  });

  it('can always read plans, docs, the key policy and sign-in providers', async () => {
    for (const path of ['/api/v1/plans', '/api/v1/key-policy', '/api/v1/openapi.json', '/api/v1/auth/providers', '/api/v1/me/access']) {
      expect((await get(path)).status, path).toBe(200);
    }
  });
});

describe('with an account', () => {
  it('passes with a session or a key, and a bad key is refused as before', async () => {
    const jar = await t.signUpVerified();
    expect((await get(SEARCH, { cookie: jar.get() })).status).toBe(200);
    const key = await createKey(jar);
    expect((await get(SEARCH, { authorization: key })).status).toBe(200);
    expect((await get(MANIFEST, { authorization: key })).status).toBe(200);
    const bad = await get(SEARCH, { authorization: `Bearer tk_${'x'.repeat(43)}` });
    expect([bad.status, await json(bad)]).toEqual([401, { error: 'invalid_api_key' }]);
  });
});

describe('the policy', () => {
  it('lists every group with its default, and an admin switch applies at once', async () => {
    const listed = async () => ((await json(await get('/api/v1/key-policy'))).groups as { group: string; keyRequired: boolean }[]);
    expect(await listed()).toEqual(KEY_POLICY_GROUPS.map(g => expect.objectContaining({ group: g.group, keyRequired: g.keyRequired })));

    const admin = (await t.session((await t.signUpVerified()).get()))!.user.id;
    expect(t.policy.set(['geo'], false, admin)).toBe(true);
    expect((await get(SEARCH)).status).toBe(200);
    expect((await listed()).find(g => g.group === 'geo')).toMatchObject({ keyRequired: false });
    expect(t.policy.list().find(g => g.group === 'geo')).toMatchObject({ updatedBy: 'ada@example.com' });

    expect(t.policy.set(null, true, admin)).toBe(true);
    expect((await get(ORBIT)).status).toBe(401);
    expect((await listed()).every(g => g.keyRequired)).toBe(true);
    expect(t.policy.set(['nope'], false, admin)).toBe(false);

    const audit = t.db.prepare("SELECT subject_id, data FROM audit_event WHERE action = 'api.key_policy.set' ORDER BY audit_id").all() as { subject_id: string; data: string }[];
    // Setting a group to what it already is writes nothing: geo back on, satellites on, the rest unchanged.
    expect(audit.map(a => [a.subject_id, JSON.parse(a.data).keyRequired])).toEqual([['geo', false], ['geo', true], ['satellites', true]]);
  });

  it('keeps an admin\'s switch when its migration runs again', async () => {
    const admin = (await t.session((await t.signUpVerified()).get()))!.user.id;
    t.policy.set(['geo'], false, admin);
    const latest = t.db.pragma('user_version', { simple: true });
    // Back to before migration 8, which made api_access_policy.
    t.db.pragma('user_version = 8');
    migrateAppSchema(t.db);
    expect(t.db.pragma('user_version', { simple: true })).toBe(latest);
    expect(t.policy.list().find(g => g.group === 'geo')).toMatchObject({ keyRequired: false });
  });

  it('classifies every /api/v1 route group as switchable or always open', () => {
    const switchable = new Set<string>(KEY_POLICY_GROUPS.map(g => g.group));
    const open = new Set<string>(OPEN_GROUPS);
    const routes = t.app.routes.filter(r => !r.path.endsWith('*')).map(r => r.path);
    const groups = new Set(routes.filter(path => path.startsWith('/api/v1/')).map(path => path.split('/')[3]));
    if (routes.some(path => path.startsWith('/api/replay/'))) groups.add('replay');
    for (const group of groups) expect(switchable.has(group) || open.has(group), group).toBe(true);
    for (const group of [...switchable, ...open]) expect(groups.has(group), `${group} has no route`).toBe(true);
  });
});
