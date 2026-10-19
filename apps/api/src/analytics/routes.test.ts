import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { grantPlan } from '../access/grants';
import { DAY_MS, isoDay } from '../access/usage';
import { adminKit } from '../admin/testing';
import { Jar, startApp, type TestApp } from '../testing/helpers';

let t: TestApp;
let kit: ReturnType<typeof adminKit>;
let ada: Jar;
let adaId: string;
let root: { jar: Jar; id: string };

// A Wednesday; its week starts on Monday 2026-10-12.
const NOW = Date.UTC(2026, 9, 14, 12);
const TODAY = Math.floor(NOW / DAY_MS);
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  t = await startApp();
  kit = adminKit(t);
  ada = await t.signUpVerified();
  adaId = await kit.userIdOf(ada);
  root = await kit.admin();
});

afterEach(() => {
  vi.useRealTimers();
  t.close();
});

const get = async <T>(path: string) => {
  const res = await kit.call(root.jar, 'GET', `/api/admin/analytics${path}`);
  expect(res.status).toBe(200);
  return kit.json<T>(res);
};

/** Ada and root on the map today, Ada yesterday too; one visitor today and another yesterday. */
function seedMinutes() {
  const minutes = t.db.prepare('INSERT INTO map_time (day, subject_type, subject_id, minutes, last_tick_at) VALUES (?, ?, ?, ?, 0)');
  minutes.run(TODAY, 'user', adaId, 5);
  minutes.run(TODAY - 1, 'user', adaId, 3);
  minutes.run(TODAY, 'user', root.id, 7);
  minutes.run(TODAY, 'anon', 'visitor-a', 2);
  minutes.run(TODAY - 1, 'anon', 'visitor-b', 1);
  const feature = t.db.prepare('INSERT INTO feature_time (day, subject_type, subject_id, feature, minutes) VALUES (?, ?, ?, ?, ?)');
  for (const [day, type, id, name, n] of [
    [TODAY, 'user', adaId, 'view:map', 4], [TODAY, 'user', adaId, 'panel:layers', 3], [TODAY, 'user', adaId, 'layer:flights', 4],
    [TODAY - 1, 'user', adaId, 'view:history', 3], [TODAY - 1, 'user', adaId, 'panel:history', 3],
    [TODAY, 'user', root.id, 'view:map', 7], [TODAY, 'user', root.id, 'panel:ai', 7],
    [TODAY, 'anon', 'visitor-a', 'view:map', 2], [TODAY, 'anon', 'visitor-a', 'view:wall', 1],
    [TODAY - 1, 'anon', 'visitor-b', 'view:map', 1],
  ] as const) feature.run(day, type, id, name, n);
  const hour = t.db.prepare('INSERT INTO activity_hour (day, hour, subject_type, minutes) VALUES (?, ?, ?, ?)');
  hour.run(TODAY, 10, 'user', 12);
  hour.run(TODAY, 10, 'anon', 2);
  hour.run(TODAY - 1, 23, 'user', 3);
}

describe('analytics in the console', () => {
  it('is behind the gate', async () => {
    for (const path of ['audience', 'engagement', 'api', 'storage', 'data', 'system']) await kit.expectGated('GET', `/api/admin/analytics/${path}`, ada);
  });

  it('refuses ranges other than 7, 30 and 90 days', async () => {
    expect((await kit.call(root.jar, 'GET', '/api/admin/analytics/audience?days=12')).status).toBe(400);
    expect((await kit.call(root.jar, 'GET', '/api/admin/analytics/audience?admins=maybe')).status).toBe(400);
  });

  it('counts accounts, sign-ins, plans, devices, active days and cohorts, with or without admins', async () => {
    seedMinutes();
    t.db.prepare('UPDATE auth_session SET userAgent = ? WHERE userId = ?').run(IPHONE, adaId);
    grantPlan(t.db, { userId: adaId, planId: 'pro', actor: { type: 'admin', id: root.id } });
    t.access.invalidate();
    const sessions = (id: string) => t.db.prepare('SELECT count(*) FROM auth_session WHERE userId = ? AND impersonatedBy IS NULL').pluck().get(id) as number;

    type Audience = Record<string, unknown> & {
      days: { day: string; signups: number; activeUsers: number; activeVisitors: number; userMinutes: number; visitorMinutes: number; sessions: number }[];
      totals: Record<string, number>; plans: unknown[]; providers: unknown[]; devices: { kind: string; name: string; sessions: number }[];
      cohorts: { week: string; size: number; retained: (number | null)[] }[];
    };
    const all = await get<Audience>('/audience?days=7');
    expect(all).toMatchObject({ today: isoDay(TODAY), since: isoDay(TODAY - 1) });
    expect(all.days).toHaveLength(7);
    expect(all.days.at(-1)).toEqual({
      day: isoDay(TODAY), signups: 2, activeUsers: 2, activeVisitors: 1, userMinutes: 12, visitorMinutes: 2, sessions: sessions(adaId) + sessions(root.id),
    });
    expect(all.days.at(-2)).toMatchObject({ signups: 0, activeUsers: 1, activeVisitors: 1, userMinutes: 3, visitorMinutes: 1 });
    expect(all.totals).toEqual({
      users: 2, verified: 2, twoFactor: 1, banned: 0, dau: 2, wau: 2, mau: 2, visitorsToday: 1, avgUserMinutes: 5, avgVisitorMinutes: 1.5,
    });
    expect(all.providers).toEqual([{ provider: 'credential', users: 2 }]);
    expect(all.plans).toEqual([{ plan: 'free', users: 1 }, { plan: 'pro', users: 1 }]);
    expect(all.devices).toContainEqual({ kind: 'os', name: 'iOS', sessions: sessions(adaId) });
    expect(all.devices).toContainEqual({ kind: 'device', name: 'mobile', sessions: sessions(adaId) });
    expect(all.cohorts).toHaveLength(8);
    // The tick started yesterday, so only this week can be measured.
    expect(all.cohorts.at(-1)).toEqual({ week: '2026-10-12', size: 2, retained: [1, null, null, null, null, null, null, null] });
    expect(all.cohorts.at(-2)).toEqual({ week: '2026-10-05', size: 0, retained: [null, 0, null, null, null, null, null, null] });

    const people = await get<Audience>('/audience?days=7&admins=exclude');
    expect(people.days.at(-1)).toMatchObject({ signups: 1, activeUsers: 1, userMinutes: 5, sessions: sessions(adaId) });
    expect(people.totals).toMatchObject({ users: 1, twoFactor: 0, dau: 1, avgUserMinutes: 4 });
    expect(people.plans).toEqual([{ plan: 'pro', users: 1 }, { plan: 'free', users: 0 }]);
  });

  it('shows where the minutes went: features, hours, session lengths, top users and the wall', async () => {
    seedMinutes();
    type Engagement = {
      days: number; since: string;
      features: { feature: string; minutes: number; users: number; visitors: number }[];
      featureDays: { day: string; minutes: Record<string, number> }[];
      hours: { dow: number; hour: number; minutes: number }[];
      sessionLength: { bucket: string; users: number; visitors: number }[];
      topUsers: { userId: string; email: string; minutes: number; activeDays: number; lastDay: string; topFeature: string | null }[];
      wall: { day: string; users: number; visitors: number }[];
    };
    const e = await get<Engagement>('/engagement?days=7');
    expect(e).toMatchObject({ days: 7, since: isoDay(TODAY - 1) });
    expect(e.features[0]).toEqual({ feature: 'view:map', minutes: 14, users: 2, visitors: 2 });
    expect(e.features.find(f => f.feature === 'layer:flights')).toEqual({ feature: 'layer:flights', minutes: 4, users: 1, visitors: 0 });
    expect(Object.keys(e.featureDays[0].minutes).sort()).toEqual(['panel:ai', 'panel:history', 'panel:layers', 'view:history', 'view:map', 'view:wall']);
    expect(e.featureDays.at(-1)!.minutes).toMatchObject({ 'view:map': 13, 'panel:history': 0 });
    expect(e.hours).toEqual([{ dow: 2, hour: 23, minutes: 3 }, { dow: 3, hour: 10, minutes: 14 }]);
    expect(e.sessionLength.find(b => b.bucket === '2–5')).toEqual({ bucket: '2–5', users: 2, visitors: 1 });
    expect(e.sessionLength.find(b => b.bucket === '6–15')).toEqual({ bucket: '6–15', users: 1, visitors: 0 });
    expect(e.topUsers.map(u => [u.email, u.minutes, u.activeDays, u.lastDay, u.topFeature])).toEqual([
      ['ada@example.com', 8, 2, isoDay(TODAY), 'panel:history'],
      ['root@example.com', 7, 1, isoDay(TODAY), 'panel:ai'],
    ]);
    expect(e.wall.at(-1)).toEqual({ day: isoDay(TODAY), users: 0, visitors: 1 });

    const people = await get<Engagement>('/engagement?days=7&admins=exclude');
    expect(people.features[0]).toEqual({ feature: 'view:map', minutes: 7, users: 1, visitors: 2 });
    expect(people.topUsers.map(u => u.email)).toEqual(['ada@example.com']);
  });

  it('sums the public API by day and route group, and ranks the keys', async () => {
    const key = await kit.json<{ id: string; key: string; prefix: string }>(await kit.call(ada, 'POST', '/api/v1/keys', { name: 'scraper' }));
    const hit = (times: number, headers: Record<string, string> = {}) =>
      Promise.all(Array.from({ length: times }, async () => expect((await t.app.request('/api/v1/me/access', { headers })).status).toBe(200)));
    await hit(2);
    await hit(3, { cookie: ada.get() });
    await hit(2, { authorization: `Bearer ${key.key}` });

    type Api = { days: { day: string; requests: number; denied: number; bytes: number; callers: number; keys: number }[]; groups: { group: string; requests: number }[]; keys: Record<string, number>; topKeys: Record<string, unknown>[] };
    const api = await get<Api>('/api?days=7');
    expect(api.days).toHaveLength(7);
    // Creating the key was a request too.
    expect(api.days.at(-1)).toMatchObject({ day: isoDay(TODAY), requests: 8, denied: 0, callers: 2, keys: 1 });
    expect(api.groups.map(g => [g.group, g.requests])).toEqual([['me', 7], ['keys', 1]]);
    expect(api.keys).toEqual({ total: 1, active: 1, revoked: 0, usedInRange: 1, createdInRange: 1 });
    expect(api.topKeys).toEqual([{ keyId: key.id, prefix: key.prefix, name: 'scraper', email: 'ada@example.com', requests: 2, denied: 0 }]);
  });

  it('reports the process, its jobs and the console records', async () => {
    t.db.prepare("INSERT INTO issue_report (created_at, message) VALUES (?, 'broken')").run(NOW);
    grantPlan(t.db, { userId: adaId, planId: 'pro', actor: { type: 'admin', id: root.id } });
    type System = {
      node: string; eventLoopLagMs: number | null; http: { group: string; requests: number }[]; backups: unknown;
      jobs: { kind: string; pending: number; failed: number; done: number }[];
      reports: { open: number; resolved: number; days: { day: string; created: number }[] };
      audit: { days: { day: string; events: number }[]; actions: { action: string; events: number }[] };
      workspaces: { total: number; createdInRange: number };
    };
    const s = await get<System>('/system?days=7');
    expect(s.node).toBe(process.version);
    expect(s.eventLoopLagMs).toBeNull();
    expect(s.http.find(h => h.group === 'auth')!.requests).toBeGreaterThan(0);
    expect(s.backups).toBeNull();
    const jobs = t.db.prepare('SELECT count(*) FROM job').pluck().get() as number;
    expect(s.jobs.reduce((n, j) => n + j.pending + j.failed + j.done, 0)).toBe(jobs);
    expect(s.reports).toMatchObject({ open: 1, resolved: 0 });
    expect(s.reports.days.at(-1)).toEqual({ day: isoDay(TODAY), created: 1 });
    expect(s.audit.actions).toContainEqual({ action: 'plan.grant', events: 1 });
    expect(s.workspaces).toEqual({ total: 0, createdInRange: 0 });
  });

  it('has no storage or ingest data to show without data directories', async () => {
    const storage = await get<{ groups: unknown[]; total: number; disk: unknown; appTables: { table: string; rows: number }[] }>('/storage');
    expect(storage).toMatchObject({ groups: [], total: 0, disk: null });
    expect(storage.appTables).toContainEqual({ table: 'auth_user', rows: 2 });
    const data = await get<{ available: boolean; days: unknown[]; sources: unknown[] }>('/data?days=7');
    expect(data).toMatchObject({ available: false, sources: [] });
    expect(data.days).toHaveLength(7);
  });
});
