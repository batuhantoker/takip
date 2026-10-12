import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dataLayout, openWriter, SqliteCatalogStore } from '@takip/db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openReplayData, type ReplayData } from '../replay/data';
import { startApp, type Jar, type TestApp } from '../testing/helpers';
import { setPlanValue } from './grants';

const OPERATOR = { type: 'admin', id: 'test' } as const;
const MANIFEST = '/api/replay/manifest';
const from = (remoteAddress: string) => ({ incoming: { socket: { remoteAddress } } });
const limitHeaders = (res: Response) => ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After'].map(h => res.headers.get(h));

let dir: string;
let replay: ReplayData;
let t: TestApp;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'replay-limits-'));
  // An empty catalogue: the replay routes answer 200, with nothing sealed yet.
  new SqliteCatalogStore(openWriter(dataLayout(dir).catalog, 'catalog')).db.close();
  replay = openReplayData(dir);
  t = await startApp({}, undefined, { enforceLimits: true, replay });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-12T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
  t.close();
  replay.close();
  rmSync(dir, { recursive: true, force: true });
});

const get = (path: string, headers: Record<string, string> = {}, peer = '203.0.113.5') => t.app.request(path, { headers }, from(peer));
const setPlan = (key: string, value: string) => {
  setPlanValue(t.db, { planId: 'free', key, value, actor: OPERATOR });
  t.access.invalidate();
};
const createKey = async (jar: Jar, scopes: string[] = []) => {
  const res = await t.app.request('/api/v1/keys', {
    method: 'POST',
    headers: { cookie: jar.get(), 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'replay', scopes }),
  });
  expect(res.status).toBe(201);
  return `Bearer ${((await res.json()) as { key: string }).key}`;
};
const counted = () => {
  t.usage.flush();
  return t.db.prepare('SELECT route_group, SUM(requests) AS requests, SUM(denied) AS denied FROM usage_counter GROUP BY route_group ORDER BY route_group').all();
};

describe('on /api/replay', () => {
  it('let a viewport burst of 150 through at once, on buckets apart from /api/v1', async () => {
    for (let i = 199; i >= 50; i--) {
      const res = await get(MANIFEST);
      expect(res.status).toBe(200);
      expect(limitHeaders(res).slice(0, 2)).toEqual(['20', String(i)]);
    }
    const v1 = await get('/api/v1/me/access');
    expect([v1.status, ...limitHeaders(v1)]).toEqual([200, '10', '29', '1', null]);

    for (let i = 0; i < 29; i++) await get('/api/v1/me/access');
    expect((await get('/api/v1/me/access')).status).toBe(429);
    expect(limitHeaders(await get(MANIFEST)).slice(0, 2)).toEqual(['20', '49']);
    expect(counted()).toEqual([{ route_group: 'me', requests: 30, denied: 1 }, { route_group: 'replay', requests: 151, denied: 0 }]);
  });

  it('refuse a sustained overrun with 429 and Retry-After, as /api/v1 does, refilling at twice web.rps', async () => {
    for (let i = 0; i < 200; i++) expect((await get(MANIFEST)).status).toBe(200);
    const refused = await get(MANIFEST);
    expect(refused.status).toBe(429);
    expect(limitHeaders(refused)).toEqual(['20', '0', '10', '1']);
    expect(await refused.json()).toEqual({ error: 'rate_limited', retry_after: 1 });

    for (let second = 0; second < 3; second++) {
      vi.advanceTimersByTime(1_000);
      for (let i = 0; i < 20; i++) expect((await get(MANIFEST)).status).toBe(200);
      expect((await get(MANIFEST)).status).toBe(429);
    }
    expect((await get(MANIFEST, {}, '203.0.113.6')).status).toBe(200);
    expect(counted()).toEqual([{ route_group: 'replay', requests: 261, denied: 4 }]);
  });

  it('take API keys at twice api.rps, counting them against their owner\'s daily quota', async () => {
    const jar = await t.signUpVerified();
    const userId = (await t.session(jar.get()))!.user.id;
    expect((await get(MANIFEST, { cookie: jar.get() })).headers.get('RateLimit-Limit')).toBe('40');

    const key = await createKey(jar);
    const res = await get(MANIFEST, { authorization: key });
    expect([res.status, res.headers.get('RateLimit-Limit')]).toEqual([200, '4']);
    expect(t.usage.quotaUsed(userId)).toBe(1);

    setPlan('api.requests_per_day', '3');
    expect((await get('/api/v1/me/access', { authorization: key })).status).toBe(200);
    expect((await get(MANIFEST, { authorization: key })).status).toBe(200);
    const over = await get(MANIFEST, { authorization: key });
    expect(over.status).toBe(429);
    expect(await over.json()).toMatchObject({ error: 'quota_exceeded', limit: 3, used: 3 });
  });

  it('refuse a bad Bearer with 401, never falling back to the session', async () => {
    const jar = await t.signUpVerified();
    for (const authorization of [`Bearer tk_${'A'.repeat(43)}`, 'Bearer not-a-key']) {
      const res = await get(MANIFEST, { authorization, cookie: jar.get() });
      expect([res.status, res.headers.get('WWW-Authenticate'), await res.json()]).toEqual([401, 'Bearer error="invalid_token"', { error: 'invalid_api_key' }]);
    }
  });

  it('hold a key limited by scope to read:tracks', async () => {
    const jar = await t.signUpVerified();
    setPlan('api.keys.max', '2');
    const events = await get(MANIFEST, { authorization: await createKey(jar, ['read:events']) });
    expect([events.status, await events.json()]).toEqual([403, { error: 'insufficient_scope', scope: 'read:tracks' }]);
    expect((await get(MANIFEST, { authorization: await createKey(jar, ['read:tracks']) })).status).toBe(200);
  });
});
