import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { grantPlan, setPlanValue } from '../access/grants';
import { withAccess, type AccessEnv } from '../access/middleware';
import { createLogger } from '../obs/logger';
import { Jar, USER, linkIn, startApp, type TestApp } from '../testing/helpers';
import { createApiKeys } from './api-keys';
import { requiresScope } from './scopes';
import { newKey } from './token';

const OPERATOR = { type: 'admin', id: 'test' } as const;
const NOW = new Date('2026-10-12T12:00:00.000Z');
const UNKNOWN_KEY = `tk_${'A'.repeat(43)}`;

type Created = { id: string; key: string; prefix: string; name: string; scopes: string[]; createdAt: number; expiresAt: number | null; lastUsedAt: number | null };

let t: TestApp;
let log: string[];
let jar: Jar;
let userId: string;

beforeEach(async () => {
  log = [];
  const logger = createLogger({ LOG_LEVEL: 'info', NODE_ENV: 'production' }, { write: line => log.push(line) });
  t = await startApp({}, { logger }, { enforceLimits: true });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  jar = await t.signUpVerified();
  userId = (await t.session(jar.get()))!.user.id;
});

afterEach(() => {
  vi.useRealTimers();
  t.close();
});

const request = (path: string, { method = 'GET', cookie = '', key = '', body }: { method?: string; cookie?: string; key?: string; body?: unknown } = {}) =>
  t.app.request(path, {
    method,
    headers: {
      ...(cookie && { cookie }),
      ...(key && { authorization: `Bearer ${key}` }),
      ...(body !== undefined && { 'content-type': 'application/json' }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
const json = async <T = Record<string, unknown>>(res: Response) => (await res.json()) as T;
const withKey = (key: string) => request('/api/v1/me/access', { key });
const create = (body: object = { name: 'laptop' }) => request('/api/v1/keys', { method: 'POST', cookie: jar.get(), body });
const createKey = async (body?: object) => {
  const res = await create(body);
  expect(res.status).toBe(201);
  return json<Created>(res);
};
const setPlan = (key: string, value: string, planId = 'free') => {
  setPlanValue(t.db, { planId, key, value, actor: OPERATOR });
  t.access.invalidate();
};
const later = (ms: number) => vi.setSystemTime(Date.now() + ms);

describe('a new key', () => {
  it('is shown once, stored only as a hash, and works as a Bearer token with principal kind key', async () => {
    const created = await createKey({ name: 'laptop' });
    expect(created.key).toMatch(/^tk_[A-Za-z0-9_-]{43}$/);
    expect(created).toMatchObject({ name: 'laptop', prefix: created.key.slice(0, 11), scopes: [], expiresAt: null, lastUsedAt: null });

    const listed = await json<{ keys: object[] }>(await request('/api/v1/keys', { cookie: jar.get() }));
    expect(listed.keys).toEqual([{ ...created, key: undefined }]);
    const stored = JSON.stringify([...t.db.prepare('SELECT * FROM api_key').all(), ...t.db.prepare('SELECT * FROM audit_event').all()]);
    expect(stored).not.toContain(created.key.slice(3));

    log.length = 0;
    const res = await withKey(created.key);
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ plan: { id: 'free' } });
    // api.rps (free: 2), not web.rps (free: 20): the limiter saw a key.
    expect(res.headers.get('RateLimit-Limit')).toBe('2');
    expect(t.usage.quotaUsed(userId)).toBe(1);
    expect(log.map(line => JSON.parse(line) as { msg: string; principal?: string }).filter(l => l.msg === 'request')).toMatchObject([{ principal: 'key' }]);
    expect(log.join('')).not.toContain(created.key.slice(3));
  });

  it('answers access as its owner, the account its limits are kept against', async () => {
    const { key } = await createKey();
    expect(await json(await withKey(key))).toMatchObject({ subject: { type: 'user', id: userId } });
  });

  it('wins over a session cookie sent alongside it', async () => {
    const { key } = await createKey();
    const res = await request('/api/v1/me/access', { cookie: jar.get(), key });
    expect(res.headers.get('RateLimit-Limit')).toBe('2');
  });

  it('is never read from the query string', async () => {
    const { key } = await createKey();
    for (const name of ['key', 'api_key', 'access_token']) {
      expect(await json(await request(`/api/v1/me/access?${name}=${key}`))).toMatchObject({ plan: { id: 'anon' } });
    }
    expect(t.usage.quotaUsed(userId)).toBe(0);
  });

  it('records its creation in the audit log, without the key', async () => {
    const { id, prefix } = await createKey({ name: 'ci', scopes: ['read:tracks'], expiresAt: '2026-12-31' });
    const rows = t.db.prepare("SELECT actor_type, actor_id, action, subject_id, data FROM audit_event WHERE action LIKE 'apikey.%'").all();
    expect(rows).toEqual([{
      actor_type: 'user', actor_id: userId, action: 'apikey.create', subject_id: userId,
      data: JSON.stringify({ keyId: id, prefix, name: 'ci', scopes: ['read:tracks'], expiresAt: Date.parse('2026-12-31T23:59:59.999Z') }),
    }]);
  });

  it('refuses bad input', async () => {
    for (const body of [{}, { name: '' }, { name: 'x'.repeat(65) }, { name: 'a', scopes: ['admin'] }, { name: 'a', expiresAt: 'soon' }, { name: 'a', expiresAt: '2026-10-11' }]) {
      const res = await create(body);
      expect([res.status, (await json(res)).error], JSON.stringify(body)).toEqual([400, 'invalid_request']);
    }
  });
});

describe('the plan', () => {
  it('allows free users one active key, counting neither revoked nor expired ones', async () => {
    const first = await createKey({ name: 'one', expiresAt: '2026-10-13' });
    const refused = await create();
    expect([refused.status, await json(refused)]).toEqual([403, { error: 'limit_reached', entitlement: 'api.keys.max', limit: 1, upgrade_url: '/pricing' }]);

    later(2 * 86_400_000);
    const second = await createKey();
    expect((await request(`/api/v1/keys/${second.id}`, { method: 'DELETE', cookie: jar.get() })).status).toBe(200);
    await createKey();
    expect((await json<{ keys: Created[] }>(await request('/api/v1/keys', { cookie: jar.get() }))).keys.map(k => k.id)).toContain(first.id);
  });

  it('allows more keys on a plan with a higher api.keys.max', async () => {
    grantPlan(t.db, { userId, planId: 'pro', actor: OPERATOR });
    t.access.invalidate();
    for (let i = 0; i < 5; i++) await createKey({ name: `k${i}` });
    expect(await json(await create())).toMatchObject({ error: 'limit_reached', limit: 5 });
  });

  it('gives visitors no keys', async () => {
    const res = await request('/api/v1/keys', { method: 'POST', body: { name: 'x' } });
    expect([res.status, await json(res)]).toEqual([401, { error: 'sign_in_required' }]);
    expect(t.access.plan('anon').entitlements['api.keys.max']).toBe(0);
  });

  it('turns keys off, new and existing, when api.enabled is off', async () => {
    const { key } = await createKey();
    setPlan('api.enabled', 'false');
    const refused = await create();
    expect([refused.status, await json(refused)]).toEqual([403, { error: 'entitlement_required', entitlement: 'api.enabled', upgrade_url: '/pricing' }]);
    const used = await withKey(key);
    expect([used.status, await json(used)]).toEqual([403, { error: 'entitlement_required', entitlement: 'api.enabled', upgrade_url: '/pricing' }]);
    // Still listed, so the owner can revoke it.
    expect((await json<{ keys: unknown[] }>(await request('/api/v1/keys', { cookie: jar.get() }))).keys).toHaveLength(1);
  });

  it("holds a key to its owner's api.rps", async () => {
    const { key } = await createKey();
    expect((await withKey(key)).status).toBe(200);
    expect((await withKey(key)).status).toBe(200);
    const refused = await withKey(key);
    expect([refused.status, (await json(refused)).error]).toEqual([429, 'rate_limited']);
  });

  it("holds a key to its owner's api.requests_per_day", async () => {
    setPlan('api.requests_per_day', '3');
    setPlan('api.rps', '100');
    const { key } = await createKey();
    for (let i = 0; i < 3; i++) expect((await withKey(key)).status).toBe(200);
    const refused = await withKey(key);
    expect([refused.status, await json(refused)]).toMatchObject([429, { error: 'quota_exceeded', limit: 3, used: 3 }]);
    expect((await request('/api/v1/me/access', { cookie: jar.get() })).status).toBe(200);
  });
});

describe('a refused key', () => {
  const refusedWith = async (res: Response, status: number, error: string) => {
    expect([res.status, await json(res)]).toEqual([status, { error }]);
    if (status === 401) expect(res.headers.get('WWW-Authenticate')).toBe('Bearer error="invalid_token"');
  };

  it('stops at once when revoked here, and within 30 s when revoked elsewhere', async () => {
    const first = await createKey();
    expect((await withKey(first.key)).status).toBe(200);
    expect(await json(await request(`/api/v1/keys/${first.id}`, { method: 'DELETE', cookie: jar.get() }))).toEqual({ ok: true });
    await refusedWith(await withKey(first.key), 401, 'invalid_api_key');

    later(1_000);
    const second = await createKey();
    expect((await withKey(second.key)).status).toBe(200);
    t.db.prepare('UPDATE api_key SET revoked_at = ? WHERE key_id = ?').run(Date.now(), second.id);
    later(29_000);
    expect((await withKey(second.key)).status).toBe(200);
    later(1_000);
    await refusedWith(await withKey(second.key), 401, 'invalid_api_key');
  });

  it('is refused once expired', async () => {
    const { key } = await createKey({ name: 'short', expiresAt: '2026-10-12' });
    expect((await withKey(key)).status).toBe(200);
    vi.setSystemTime(new Date('2026-10-13T00:00:00.000Z'));
    await refusedWith(await withKey(key), 401, 'invalid_api_key');
  });

  it('is refused when unknown or malformed, never falling back to the session', async () => {
    await refusedWith(await withKey(UNKNOWN_KEY), 401, 'invalid_api_key');
    for (const header of ['Bearer tk_short', 'Bearer ', 'Bearer', 'bearer not-a-key', `Bearer ${UNKNOWN_KEY}x`]) {
      const res = await t.app.request('/api/v1/me/access', { headers: { authorization: header, cookie: jar.get() } });
      await refusedWith(res, 401, 'invalid_api_key');
    }
  });

  it("is refused while its owner is banned, and works again once the ban's end date passes", async () => {
    const { key } = await createKey();
    expect((await withKey(key)).status).toBe(200);
    t.db.prepare('UPDATE auth_user SET banned = 1, banExpires = ? WHERE id = ?').run(new Date(Date.now() + 60 * 60_000).toISOString(), userId);
    later(30_000);
    await refusedWith(await withKey(key), 403, 'account_banned');
    later(60 * 60_000);
    expect((await withKey(key)).status).toBe(200);
  });
});

describe('guessed keys', () => {
  const from = (remoteAddress: string) => ({ incoming: { socket: { remoteAddress } } });
  const guess = (peer: string, key = newKey().key) =>
    t.app.request('/api/v1/me/access', { headers: { authorization: `Bearer ${key}` } }, from(peer));
  const statuses = async (n: number, peer: string, key?: string) => {
    const seen: number[] = [];
    for (let i = 0; i < n; i++) seen.push((await guess(peer, key)).status);
    return seen;
  };
  const times = (n: number, status: number) => Array<number>(n).fill(status);

  it('get 429 after ten failed lookups a minute from one address, and get through again as it refills', async () => {
    expect(await statuses(10, '203.0.113.5')).toEqual(times(10, 401));
    const throttled = await guess('203.0.113.5');
    expect([throttled.status, throttled.headers.get('Retry-After'), await json(throttled)]).toEqual([429, '6', { error: 'rate_limited', retry_after: 6 }]);
    expect((await guess('203.0.113.6')).status).toBe(401);

    later(6_000);
    expect(await statuses(2, '203.0.113.5')).toEqual([401, 429]);
    later(60_000);
    expect(await statuses(11, '203.0.113.5')).toEqual([...times(10, 401), 429]);
  });

  it('are counted per IPv6 /64', async () => {
    expect(await statuses(10, '2001:db8:1:2::1')).toEqual(times(10, 401));
    expect((await guess('2001:db8:1:2::ffff')).status).toBe(429);
    expect((await guess('2001:db8:1:3::1')).status).toBe(401);
  });

  it('count only lookups that reach the database, not cached or malformed ones', async () => {
    expect(await statuses(20, '203.0.113.5', UNKNOWN_KEY)).toEqual(times(20, 401));
    expect(await statuses(20, '203.0.113.5', 'tk_short')).toEqual(times(20, 401));
    expect(await statuses(9, '203.0.113.5')).toEqual(times(9, 401));
    expect((await guess('203.0.113.5')).status).toBe(429);
  });

  it('hold back only uncached lookups: a key already in the cache still works from a throttled address', async () => {
    setPlan('api.keys.max', '2');
    const used = await createKey({ name: 'used' });
    const fresh = await createKey({ name: 'fresh' });
    expect((await withKey(used.key)).status).toBe(200);
    await statuses(10, '203.0.113.5');

    expect((await guess('203.0.113.5', used.key)).status).toBe(200);
    expect((await guess('203.0.113.5', fresh.key)).status).toBe(429);
    expect((await guess('203.0.113.6', fresh.key)).status).toBe(200);
  });
});

describe('key management', () => {
  it('is for sessions only: a key can list, create or revoke nothing', async () => {
    setPlan('api.rps', '100');
    const { key, id } = await createKey();
    for (const [method, path] of [['GET', '/api/v1/keys'], ['POST', '/api/v1/keys'], ['DELETE', `/api/v1/keys/${id}`]] as const) {
      const res = await request(path, { method, key, cookie: jar.get(), ...(method === 'POST' && { body: { name: 'more' } }) });
      expect([res.status, await json(res)], `${method} ${path}`).toEqual([403, { error: 'session_required' }]);
    }
    expect((await withKey(key)).status).toBe(200);
  });

  it("can't touch another user's key", async () => {
    const { id, key } = await createKey();
    const other = await t.signUpVerified(new Jar(), { ...USER, email: 'grace@example.com' });
    const res = await request(`/api/v1/keys/${id}`, { method: 'DELETE', cookie: other.get() });
    expect([res.status, await json(res)]).toEqual([404, { error: 'not_found' }]);
    expect((await json<{ keys: unknown[] }>(await request('/api/v1/keys', { cookie: other.get() }))).keys).toEqual([]);
    expect((await withKey(key)).status).toBe(200);
  });

  it('records a revocation once', async () => {
    const { id, prefix } = await createKey();
    expect((await request(`/api/v1/keys/${id}`, { method: 'DELETE', cookie: jar.get() })).status).toBe(200);
    expect((await request(`/api/v1/keys/${id}`, { method: 'DELETE', cookie: jar.get() })).status).toBe(404);
    expect(t.db.prepare("SELECT actor_type, action, data FROM audit_event WHERE action = 'apikey.revoke'").all())
      .toEqual([{ actor_type: 'user', action: 'apikey.revoke', data: JSON.stringify({ keyId: id, prefix, name: 'laptop' }) }]);
    expect((await json<{ keys: unknown[] }>(await request('/api/v1/keys', { cookie: jar.get() }))).keys).toEqual([]);
  });

  it('writes last_used_at at most once a minute', async () => {
    setPlan('api.rps', '100');
    const { key } = await createKey();
    const lastUsed = async () => (await json<{ keys: Created[] }>(await request('/api/v1/keys', { cookie: jar.get() }))).keys[0].lastUsedAt;

    await withKey(key);
    const first = Date.now();
    later(30_000);
    await withKey(key);
    await withKey(key);
    expect(await lastUsed()).toBe(first);
    later(30_000);
    await withKey(key);
    expect(await lastUsed()).toBe(Date.now());
  });

  it('logs a failed last_used_at write and still lets the key in', async () => {
    const { id, key } = await createKey();
    const lines: string[] = [];
    const keys = createApiKeys(t.db, { logger: createLogger({ LOG_LEVEL: 'info', NODE_ENV: 'production' }, { write: line => lines.push(line) }) });
    t.db.exec("CREATE TRIGGER no_touch BEFORE UPDATE OF last_used_at ON api_key BEGIN SELECT RAISE(ABORT, 'disk I/O error'); END");

    expect(keys.verify(key, '203.0.113.7').ok).toBe(true);
    expect(lines.map(line => JSON.parse(line))).toMatchObject([{ level: 50, msg: 'last_used_at write failed', keyId: id, err: { message: 'disk I/O error' } }]);
  });
});

describe('scopes', () => {
  it('are stored, and requiresScope() holds a limited key to them', async () => {
    const limited = await createKey({ name: 'tracks only', scopes: ['read:tracks', 'read:tracks'] });
    expect(limited.scopes).toEqual(['read:tracks']);

    const app = new Hono<AccessEnv>();
    app.use('*', withAccess(t.auth, t.access, createApiKeys(t.db)));
    app.get('/tracks', requiresScope('read:tracks'), c => c.text('ok'));
    app.get('/events', requiresScope('read:events'), c => c.text('ok'));
    const get = (path: string, headers: Record<string, string>) => app.request(path, { headers });

    expect((await get('/tracks', { authorization: `Bearer ${limited.key}` })).status).toBe(200);
    const refused = await get('/events', { authorization: `Bearer ${limited.key}` });
    expect([refused.status, await json(refused)]).toEqual([403, { error: 'insufficient_scope', scope: 'read:events' }]);
    expect((await get('/events', { cookie: jar.get() })).status).toBe(200);

    expect((await request(`/api/v1/keys/${limited.id}`, { method: 'DELETE', cookie: jar.get() })).status).toBe(200);
    const unrestricted = await createKey({ name: 'everything' });
    expect((await get('/events', { authorization: `Bearer ${unrestricted.key}` })).status).toBe(200);
  });
});

describe('account deletion', () => {
  it("removes the user's keys", async () => {
    const { key } = await createKey();
    expect((await withKey(key)).status).toBe(200);
    expect((await t.post('/api/auth/delete-user', { callbackURL: '/?account=deleted' }, { cookie: jar.get() })).status).toBe(200);
    expect((await t.app.request(linkIn(await t.inbox.next()), { headers: { cookie: jar.get() } })).status).toBe(302);

    expect(t.db.prepare('SELECT count(*) FROM api_key WHERE user_id = ?').pluck().get(userId)).toBe(0);
    later(30_000);
    expect((await withKey(key)).status).toBe(401);
  });
});

describe('the OpenAPI document', () => {
  it('declares the bearer scheme', async () => {
    const spec = await json<{ components: { securitySchemes: Record<string, unknown> } }>(await t.app.request('/api/v1/openapi.json'));
    expect(spec.components.securitySchemes.apiKey).toMatchObject({ type: 'http', scheme: 'bearer' });
  });
});
