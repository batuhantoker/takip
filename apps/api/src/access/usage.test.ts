import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startApp, type Jar, type TestApp } from '../testing/helpers';
import type { Principal } from './principal';
import { DAY_MS, createUsage, routeGroup, utcDay } from './usage';

const NOW = new Date('2026-10-12T12:00:00.000Z');
const TODAY = utcDay(NOW.getTime());
const ada: Principal = { kind: 'user', userId: 'u1', ip: '203.0.113.5' };
const adaKey: Principal = { kind: 'key', keyId: 'k1', userId: 'u1', ip: '203.0.113.5' };
const visitor: Principal = { kind: 'anon', ip: '203.0.113.9' };

let t: TestApp;

beforeEach(async () => {
  t = await startApp();
});

afterEach(() => {
  vi.useRealTimers();
  t.close();
});

const rows = () => t.db.prepare('SELECT day, subject_type, subject_id, key_id, route_group, requests, bytes, denied FROM usage_counter ORDER BY subject_type, key_id, route_group').all();

describe('the meter', () => {
  it('flushes every 10 s and once more on stop', () => {
    vi.useFakeTimers({ now: NOW });
    const usage = createUsage(t.db);
    const stop = usage.start();
    usage.admit(ada, 'geo');
    usage.admit(adaKey, 'geo');
    usage.deny(adaKey, 'geo');
    usage.addBytes(ada, 'geo', 512);

    vi.advanceTimersByTime(9_999);
    expect(rows()).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(rows()).toEqual([
      { day: TODAY, subject_type: 'user', subject_id: 'u1', key_id: '', route_group: 'geo', requests: 1, bytes: 512, denied: 0 },
      { day: TODAY, subject_type: 'user', subject_id: 'u1', key_id: 'k1', route_group: 'geo', requests: 1, bytes: 0, denied: 1 },
    ]);

    usage.admit(ada, 'geo');
    vi.advanceTimersByTime(10_000);
    usage.admit(ada, 'geo');
    stop();
    expect(rows()[0]).toMatchObject({ key_id: '', requests: 3 });
    vi.advanceTimersByTime(60_000);
    expect(rows()[0]).toMatchObject({ requests: 3 });
  });

  it('adds to what is stored rather than overwriting it', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    const first = createUsage(t.db);
    first.admit(ada, 'geo');
    first.flush();
    const rebooted = createUsage(t.db);
    rebooted.admit(ada, 'geo');
    rebooted.flush();
    expect(rows()).toMatchObject([{ requests: 2 }]);
  });

  it('reloads today\'s API-key requests at boot, and only today\'s', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    t.db.prepare(`INSERT INTO usage_counter (day, subject_type, subject_id, key_id, route_group, requests) VALUES
      (?, 'user', 'u1', 'k1', 'geo', 40), (?, 'user', 'u1', 'k2', 'tiles', 2), (?, 'user', 'u1', '', 'me', 500), (?, 'user', 'u1', 'k1', 'geo', 900)`)
      .run(TODAY, TODAY, TODAY, TODAY - 1);
    expect(createUsage(t.db).quotaUsed('u1')).toBe(42);
  });

  it('starts a fresh quota at UTC midnight and books late requests on the new day', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-12T23:59:59.900Z') });
    const usage = createUsage(t.db);
    usage.admit(adaKey, 'geo');
    expect(usage.quotaUsed('u1')).toBe(1);
    vi.setSystemTime(new Date('2026-10-13T00:00:00.000Z'));
    expect(usage.quotaUsed('u1')).toBe(0);
    usage.admit(adaKey, 'geo');
    usage.flush();
    expect(rows().map(r => (r as { day: number }).day)).toEqual([TODAY, TODAY + 1]);
  });

  it('counts a visitor by a salted daily hash, never by address', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    const usage = createUsage(t.db);
    usage.admit(visitor, 'me');
    usage.admit(visitor, 'me');
    usage.admit({ kind: 'anon', ip: '203.0.113.10' }, 'me');
    vi.setSystemTime(NOW.getTime() + DAY_MS);
    usage.admit(visitor, 'me');
    usage.flush();
    const ids = (rows() as { subject_type: string; subject_id: string; requests: number }[]).map(r => [r.subject_id, r.requests] as const);
    expect(ids).toHaveLength(3);
    expect(ids.filter(([, n]) => n === 2)).toHaveLength(1);
    for (const [id] of ids) expect(id).not.toContain('203.0.113');
    expect(new Set(ids.map(([id]) => id)).size).toBe(3);
  });

  it('names the group after the matched /api/v1 route, and lumps unmatched paths together', async () => {
    const app = new Hono();
    const seen: string[] = [];
    app.use('/api/v1/*', async (c, next) => {
      seen.push(routeGroup(c));
      await next();
    });
    app.get('/api/v1/geo/search', c => c.text('ok'));
    app.get('/api/v1/workspaces/:id', c => c.text('ok'));
    for (const path of ['/api/v1/geo/search', '/api/v1/workspaces/42', '/api/v1/wp-admin', '/api/v1/geo/nope']) await app.request(path);
    expect(seen).toEqual(['geo', 'workspaces', 'other', 'other']);
  });
});

describe('GET /api/v1/usage', () => {
  const get = (jar?: Jar) => t.app.request('/api/v1/usage', { headers: jar ? { cookie: jar.get() } : {} });

  it('asks visitors to sign in', async () => {
    const res = await get();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'sign_in_required' });
  });

  it('shows the caller their own requests by group, today and over 30 days', async () => {
    const jar = await t.signUpVerified();
    const userId = (await t.session(jar.get()))!.user.id;
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    t.db.prepare(`INSERT INTO usage_counter (day, subject_type, subject_id, key_id, route_group, requests, bytes, denied) VALUES
      (?, 'user', ?, 'k1', 'geo', 7, 700, 1), (?, 'user', ?, '', 'geo', 3, 0, 0), (?, 'user', ?, '', 'geo', 99, 0, 0), (?, 'user', 'someone-else', '', 'me', 5, 0, 0)`)
      .run(TODAY - 2, userId, TODAY - 2, userId, TODAY - 30, userId, TODAY);
    t.usage.admit({ kind: 'key', keyId: 'k1', userId, ip: '203.0.113.5' }, 'geo');

    for (let i = 0; i < 2; i++) expect((await t.app.request('/api/v1/me/access', { headers: { cookie: jar.get() } })).status).toBe(200);
    const res = await get(jar);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const zero = { bytes: 0, denied: 0 };
    expect(await res.json()).toEqual({
      day: '2026-10-12',
      today: { me: { requests: 2, ...zero }, usage: { requests: 1, ...zero }, geo: { requests: 1, ...zero } },
      days: [
        { day: '2026-10-10', groups: { geo: { requests: 10, bytes: 700, denied: 1 } } },
        { day: '2026-10-12', groups: { me: { requests: 2, ...zero }, usage: { requests: 1, ...zero }, geo: { requests: 1, ...zero } } },
      ],
      quota: { limit: 1000, used: 1, reset_at: '2026-10-13T00:00:00.000Z' },
    });
  });
});
