import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAY_MS, isoDay } from '../access/usage';
import { ADMIN, adminKit } from '../admin/testing';
import { Jar, startApp, type TestApp } from '../testing/helpers';

let t: TestApp;
let kit: ReturnType<typeof adminKit>;
let root: { jar: Jar; id: string };
let adaId: string;
let beaId: string;

const NOW = Date.UTC(2026, 9, 14, 12);
const TODAY = Math.floor(NOW / DAY_MS);
const HOUR = 3_600_000;
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1';
const BEA = { name: 'Bea', email: 'bea@example.invalid', password: 'another horse battery' };

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  t = await startApp();
  kit = adminKit(t);
  adaId = await kit.userIdOf(await t.signUpVerified());
  vi.setSystemTime(NOW + 1000);
  beaId = await kit.userIdOf(await t.signUpVerified(new Jar(), BEA));
  vi.setSystemTime(NOW + 2000);
  root = await kit.admin();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  t.close();
});

/**
 * Ada: on the map today and yesterday, a key's traffic, one sign-in of her own and one by an admin viewing as her,
 * three keys (one live), two workspaces (one deleted), a report. Bea: last on the map 40 days ago, heavy API use.
 */
function seed() {
  const run = (sql: string, ...rows: unknown[][]) => {
    const statement = t.db.prepare(sql);
    for (const row of rows) statement.run(...row);
  };
  t.db.prepare('DELETE FROM sign_in').run();
  run('INSERT INTO map_time (day, subject_type, subject_id, minutes, last_tick_at) VALUES (?, ?, ?, ?, ?)',
    [TODAY, 'user', adaId, 5, NOW - 60_000], [TODAY - 1, 'user', adaId, 3, NOW - DAY_MS], [TODAY - 40, 'user', beaId, 9, NOW - 40 * DAY_MS]);
  run('INSERT INTO feature_time (day, subject_type, subject_id, feature, minutes) VALUES (?, ?, ?, ?, ?)',
    [TODAY, 'user', adaId, 'view:map', 4], [TODAY, 'user', adaId, 'panel:none', 5], [TODAY, 'user', adaId, 'panel:layers', 3],
    [TODAY, 'user', adaId, 'layer:flights', 4], [TODAY, 'user', adaId, 'layer:wx_radar', 1],
    [TODAY - 1, 'user', adaId, 'view:history', 3], [TODAY - 1, 'user', adaId, 'layer:flights', 3]);
  run('INSERT INTO user_hour (user_id, day, hour, minutes) VALUES (?, ?, ?, ?)', [adaId, TODAY, 11, 5], [adaId, TODAY - 1, 22, 3]);
  run('INSERT INTO usage_counter (day, subject_type, subject_id, key_id, route_group, requests, bytes, denied) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [TODAY, 'user', adaId, 'k-live', 'geo', 5, 500, 0], [TODAY, 'user', beaId, '', 'replay', 20, 2000, 2]);
  run('INSERT INTO sign_in (user_id, at, ip_address, user_agent, impersonated_by) VALUES (?, ?, ?, ?, ?)',
    [adaId, NOW - HOUR, '203.0.113.9', IPHONE, null], [adaId, NOW - HOUR / 2, '198.51.100.1', 'Admin browser', root.id],
    [beaId, NOW - 40 * DAY_MS, '192.0.2.4', 'Old laptop', null]);
  t.db.prepare('UPDATE auth_session SET updatedAt = ? WHERE userId = ?').run(new Date(NOW - 2 * HOUR).toISOString(), adaId);
  run('INSERT INTO api_key (key_id, user_id, name, prefix, key_hash, created_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ['k-live', adaId, 'script', 'tk_live', Buffer.from('a'), NOW - 3 * DAY_MS, null, null],
    ['k-revoked', adaId, 'old', 'tk_old', Buffer.from('b'), NOW - 5 * DAY_MS, null, NOW - 4 * DAY_MS],
    ['k-expired', adaId, 'trial', 'tk_trial', Buffer.from('c'), NOW - 9 * DAY_MS, NOW - DAY_MS, null]);
  run('INSERT INTO ws_workspace (workspace_id, owner_id, name, state, state_version, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ['w1', adaId, 'Straits', '{}', 1, NOW - DAY_MS, NOW - HOUR, null], ['w2', adaId, 'Gone', '{}', 1, NOW - 2 * DAY_MS, NOW - DAY_MS, NOW - DAY_MS]);
  run("INSERT INTO issue_report (created_at, user_id, message) VALUES (?, ?, 'Radar is blank')", [NOW - HOUR, adaId]);
}

type Row = { email: string; plan: string; activity: Record<string, unknown> };
const list = async (query = '') => {
  const res = await kit.call(root.jar, 'GET', `/api/admin/users${query}`);
  expect(res.status).toBe(200);
  return kit.json<{ total: number; days: number; sort: string; users: Row[] }>(res);
};
const order = async (query: string) => (await list(query)).users.map(u => u.email);

describe('the Users table', () => {
  it("shows each account's activity over the range", async () => {
    seed();
    const { total, days, sort, users } = await list();
    expect({ total, days, sort }).toEqual({ total: 3, days: 30, sort: 'joined' });
    expect(users.map(u => u.email)).toEqual([ADMIN.email, BEA.email, 'ada@example.com']);
    expect(users[2]).toMatchObject({ plan: 'free' });
    expect(users[2].activity).toEqual({
      minutes: 8, activeDays: 2, lastActiveDay: isoDay(TODAY), topPanel: 'panel:layers', topLayer: 'layer:flights',
      apiRequests: 5, apiDenied: 0, signIns: 1, lastSeenAt: NOW - 60_000, lastUserAgent: IPHONE, lastIp: '203.0.113.9', keys: 1, workspaces: 1,
    });
    // Bea's minutes and sign-in fall outside the range; her session is newer than that sign-in, so it names her device.
    expect(users[1].activity).toMatchObject({ minutes: 0, activeDays: 0, lastActiveDay: isoDay(TODAY - 40), apiRequests: 20, apiDenied: 2, signIns: 0, topPanel: null, keys: 0 });
    expect(users[1].activity.lastSeenAt).toBe(NOW + 1000);
    expect(users[0].activity).toMatchObject({ minutes: 0, lastActiveDay: null, lastSeenAt: NOW + 2000 });
  });

  it('sorts by any of its measures, and keeps searching and paging', async () => {
    seed();
    expect(await order('?sort=minutes')).toEqual(['ada@example.com', ADMIN.email, BEA.email]);
    expect(await order('?sort=lastActive')).toEqual(['ada@example.com', BEA.email, ADMIN.email]);
    expect(await order('?sort=api')).toEqual([BEA.email, 'ada@example.com', ADMIN.email]);
    expect(await order('?sort=signIns')).toEqual(['ada@example.com', ADMIN.email, BEA.email]);
    expect(await order('?sort=minutes&q=example.invalid')).toEqual([BEA.email]);
    expect(await order('?sort=api&limit=1&offset=1')).toEqual(['ada@example.com']);
    expect((await list('?days=90')).users.find(u => u.email === BEA.email)!.activity).toMatchObject({ minutes: 9, activeDays: 1 });
  });

  it('refuses unknown sorts and ranges', async () => {
    for (const query of ['?sort=email; DROP TABLE auth_user', '?days=12', '?limit=0']) {
      expect((await kit.call(root.jar, 'GET', `/api/admin/users${query}`)).status, query).toBe(400);
    }
  });
});

describe("one account's analytics", () => {
  it('is behind the gate and 404s for nobody', async () => {
    const user = await t.signUpVerified(new Jar(), { ...BEA, email: 'cy@example.invalid' });
    await kit.expectGated('GET', `/api/admin/analytics/users/${adaId}`, user);
    expect((await kit.call(root.jar, 'GET', '/api/admin/analytics/users/nobody')).status).toBe(404);
  });

  it('holds everything the account did', async () => {
    seed();
    const res = await kit.call(root.jar, 'GET', `/api/admin/analytics/users/${adaId}?days=7`);
    expect(res.status).toBe(200);
    const a = await kit.json<Record<string, unknown> & {
      daily: { day: string; minutes: number; views: Record<string, number>; apiRequests: number; signIns: number }[];
      api: { groups: unknown[]; keys: { keyId: string; requests: number; revokedAt: number | null }[] };
      signIns: { at: number; impersonatedBy: string | null; impersonatorEmail: string | null }[];
      workspaces: { id: string }[];
    }>(res);
    expect(a).toMatchObject({ today: isoDay(TODAY), since: isoDay(TODAY - 1), days: 7 });
    expect(a.totals).toEqual({
      minutes: 8, activeDays: 2, avgMinutesPerActiveDay: 4, firstActiveDay: isoDay(TODAY - 1), lastActiveDay: isoDay(TODAY),
      apiRequests: 5, apiDenied: 0, apiBytes: 500, signIns: 1,
    });
    expect(a.daily).toHaveLength(7);
    expect(a.daily.at(-1)).toEqual({ day: isoDay(TODAY), minutes: 5, views: { 'view:map': 4 }, apiRequests: 5, apiDenied: 0, signIns: 1 });
    expect(a.daily.at(-2)).toMatchObject({ minutes: 3, views: { 'view:history': 3 }, signIns: 0 });
    expect(a.features).toEqual([
      { feature: 'layer:flights', minutes: 7, days: 2 },
      { feature: 'panel:none', minutes: 5, days: 1 },
      { feature: 'view:map', minutes: 4, days: 1 },
      { feature: 'panel:layers', minutes: 3, days: 1 },
      { feature: 'view:history', minutes: 3, days: 1 },
      { feature: 'layer:wx_radar', minutes: 1, days: 1 },
    ]);
    // 2026-10-14 was a Wednesday.
    expect(a.hours).toEqual([{ dow: 2, hour: 22, minutes: 3 }, { dow: 3, hour: 11, minutes: 5 }]);
    expect(a.api.groups).toEqual([{ group: 'geo', requests: 5, denied: 0, bytes: 500 }]);
    expect(a.api.keys.map(k => [k.keyId, k.requests, k.revokedAt])).toEqual([['k-live', 5, null], ['k-revoked', 0, NOW - 4 * DAY_MS], ['k-expired', 0, null]]);
    expect(a.signIns.map(s => [s.at, s.impersonatorEmail])).toEqual([[NOW - HOUR / 2, ADMIN.email], [NOW - HOUR, null]]);
    expect(a.workspaces.map(w => w.id)).toEqual(['w1', 'w2']);
    expect(a.reports).toMatchObject([{ status: 'open', message: 'Radar is blank' }]);
  });

  it("is empty but whole for an account that hasn't done anything", async () => {
    const res = await kit.call(root.jar, 'GET', `/api/admin/analytics/users/${beaId}`);
    const a = await kit.json<{ since: unknown; totals: Record<string, unknown>; daily: unknown[]; features: unknown[]; hours: unknown[] }>(res);
    expect(a.since).toBeNull();
    expect(a.totals).toMatchObject({ minutes: 0, activeDays: 0, avgMinutesPerActiveDay: 0, firstActiveDay: null });
    expect(a.daily).toHaveLength(30);
    expect([a.features, a.hours]).toEqual([[], []]);
  });
});
