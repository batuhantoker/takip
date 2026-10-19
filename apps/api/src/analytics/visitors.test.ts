import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAY_MS, isoDay } from '../access/usage';
import { ADMIN, adminKit } from '../admin/testing';
import { Jar, startApp, type TestApp } from '../testing/helpers';

let t: TestApp;
let kit: ReturnType<typeof adminKit>;
let root: { jar: Jar; id: string };
let beaId: string;

// A Wednesday.
const NOW = Date.UTC(2026, 9, 14, 12);
const TODAY = Math.floor(NOW / DAY_MS);
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/141.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1';
const BEA = { name: 'Bea', email: 'bea@example.invalid', password: 'another horse battery' };
const [ALPHA, BETA, GAMMA, OLD] = ['v-alpha-0000000001', 'v-beta-00000000002', 'v-gamma-0000000003', 'v-old-000000000004'];

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  t = await startApp();
  kit = adminKit(t);
  beaId = await kit.userIdOf(await t.signUpVerified(new Jar(), BEA));
  root = await kit.admin();
  seed();
});

afterEach(() => {
  vi.useRealTimers();
  t.close();
});

/**
 * Alpha: came from news.example.com ten days ago, back today, signed in as Bea. Beta: first seen 40 days ago, on the map
 * yesterday, met the wall today. Gamma: new today on a phone, signed in as the admin. Old: nothing in the last 90 days.
 */
function seed() {
  const run = (sql: string, ...rows: unknown[][]) => {
    const statement = t.db.prepare(sql);
    for (const row of rows) statement.run(...row);
  };
  run('INSERT INTO visitor (visitor_id, first_seen_at, last_seen_at, user_agent, referrer, landing, user_id, linked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [ALPHA, NOW - 10 * DAY_MS, NOW - 60_000, MAC, 'news.example.com', '/?utm_source=hn', beaId, NOW - 60_000],
    [BETA, NOW - 40 * DAY_MS, NOW - 30_000, null, null, '/', null, null],
    [GAMMA, NOW - 10_000, NOW - 10_000, IPHONE, null, '/docs?utm_source=hn&ref=x', root.id, NOW - 10_000],
    [OLD, NOW - 100 * DAY_MS, NOW - 95 * DAY_MS, MAC, 'old.example.com', '/', null, null]);
  run('INSERT INTO visitor_day (visitor_id, day, minutes, last_tick_at) VALUES (?, ?, ?, 0)',
    [ALPHA, TODAY - 10, 5], [ALPHA, TODAY, 3], [BETA, TODAY - 1, 2], [BETA, TODAY, 0], [GAMMA, TODAY, 1], [OLD, TODAY - 95, 4]);
  run('INSERT INTO visitor_feature (visitor_id, day, feature, minutes) VALUES (?, ?, ?, ?)',
    [ALPHA, TODAY - 10, 'view:map', 5], [ALPHA, TODAY - 10, 'panel:layers', 4], [ALPHA, TODAY - 10, 'layer:flights', 5],
    [ALPHA, TODAY, 'view:history', 3], [ALPHA, TODAY, 'panel:history', 3],
    [BETA, TODAY - 1, 'view:map', 2], [BETA, TODAY - 1, 'layer:wx_radar', 2], [BETA, TODAY, 'view:wall', 1],
    [GAMMA, TODAY, 'view:map', 1]);
  run('INSERT INTO visitor_hour (visitor_id, day, hour, minutes) VALUES (?, ?, ?, ?)', [ALPHA, TODAY - 10, 9, 5], [ALPHA, TODAY, 11, 3]);
}

const get = async <T>(path: string) => {
  const res = await kit.call(root.jar, 'GET', `/api/admin/analytics${path}`);
  expect(res.status, path).toBe(200);
  return kit.json<T>(res);
};

describe('visitors over the range', () => {
  it('counts who came, who came back, from where and on what', async () => {
    const v = await get<Record<string, unknown> & { daily: Record<string, unknown>[]; cohorts: { week: string; size: number; retained: (number | null)[] }[] }>('/visitors');
    expect(v).toMatchObject({ today: isoDay(TODAY), since: isoDay(TODAY - 100) });
    expect(v.daily).toHaveLength(30);
    expect(v.daily.at(-11)).toEqual({ day: isoDay(TODAY - 10), visitors: 1, new: 1, returning: 0, minutes: 5, signedIn: 1 });
    expect(v.daily.at(-2)).toEqual({ day: isoDay(TODAY - 1), visitors: 1, new: 0, returning: 1, minutes: 2, signedIn: 0 });
    expect(v.daily.at(-1)).toEqual({ day: isoDay(TODAY), visitors: 3, new: 1, returning: 2, minutes: 4, signedIn: 2 });
    // Alpha is new to the range and also came back on a second day.
    expect(v.totals).toEqual({ visitors: 3, new: 2, returning: 1, signedIn: 2, minutes: 11, avgMinutesPerVisitorDay: 2.8, hitWall: 1 });
    expect(v.referrers).toEqual([{ referrer: null, visitors: 1, signedIn: 1 }, { referrer: 'news.example.com', visitors: 1, signedIn: 1 }]);
    expect(v.landings).toEqual([{ landing: '/?utm_source=hn', visitors: 1 }, { landing: '/docs?utm_source=hn&ref=x', visitors: 1 }]);
    expect(v.campaigns).toEqual([{ source: 'hn', visitors: 2, signedIn: 2 }]);
    expect(v.devices).toEqual([
      { kind: 'browser', name: 'Chrome', visitors: 1 }, { kind: 'browser', name: 'Other', visitors: 1 }, { kind: 'browser', name: 'Safari', visitors: 1 },
      { kind: 'os', name: 'iOS', visitors: 1 }, { kind: 'os', name: 'macOS', visitors: 1 }, { kind: 'os', name: 'Other', visitors: 1 },
      { kind: 'device', name: 'desktop', visitors: 2 }, { kind: 'device', name: 'mobile', visitors: 1 },
    ]);
    // Weeks start on Monday: Beta's first visit fell in the week of 31 August, Alpha's in that of 28 September.
    const week = (iso: string) => v.cohorts.find(c => c.week === iso)!;
    expect(v.cohorts.map(c => c.week)).toHaveLength(8);
    expect(week('2026-08-31')).toEqual({ week: '2026-08-31', size: 1, retained: [0, 0, 0, 0, 0, 0, 1, null] });
    expect(week('2026-09-28')).toEqual({ week: '2026-09-28', size: 1, retained: [1, 0, 1, null, null, null, null, null] });
    expect(week('2026-10-12')).toEqual({ week: '2026-10-12', size: 1, retained: [1, null, null, null, null, null, null, null] });
  });

  it('leaves out browsers linked to admins when asked', async () => {
    const v = await get<{ totals: { visitors: number; signedIn: number }; campaigns: unknown[] }>('/visitors?admins=exclude');
    expect(v.totals).toMatchObject({ visitors: 2, signedIn: 1 });
    expect(v.campaigns).toEqual([{ source: 'hn', visitors: 1, signedIn: 1 }]);
  });

  it('is behind the gate', async () => {
    const user = await t.signUpVerified(new Jar(), { ...BEA, email: 'cy@example.invalid' });
    for (const path of ['/visitors', '/visitors/list', `/visitors/${ALPHA}`]) await kit.expectGated('GET', `/api/admin/analytics${path}`, user);
  });
});

type ListRow = { visitorId: string; minutes: number; activeDays: number; topPanel: string | null; topLayer: string | null; hitWall: boolean; user: unknown };
const list = (query = '') => get<{ total: number; days: number; sort: string; visitors: ListRow[] }>(`/visitors/list${query}`);
const ids = async (query: string) => (await list(query)).visitors.map(v => v.visitorId);

describe('the visitors table', () => {
  it('lists every kept browser with its time in the range', async () => {
    const { total, days, sort, visitors } = await list();
    expect({ total, days, sort }).toEqual({ total: 4, days: 30, sort: 'lastSeen' });
    expect(visitors.map(v => v.visitorId)).toEqual([GAMMA, BETA, ALPHA, OLD]);
    expect(visitors[2]).toEqual({
      visitorId: ALPHA, firstSeenAt: NOW - 10 * DAY_MS, lastSeenAt: NOW - 60_000, userAgent: MAC, referrer: 'news.example.com', landing: '/?utm_source=hn',
      linkedAt: NOW - 60_000, user: { id: beaId, email: BEA.email, name: 'Bea' }, place: null, device: null,
      minutes: 8, activeDays: 2, topPanel: 'panel:layers', topLayer: 'layer:flights', hitWall: false,
    });
    expect(visitors[1]).toMatchObject({ minutes: 2, activeDays: 1, topPanel: null, topLayer: 'layer:wx_radar', hitWall: true, user: null });
    expect(visitors[3]).toMatchObject({ minutes: 0, activeDays: 0, topLayer: null });
  });

  it('sorts, searches and pages', async () => {
    expect(await ids('?sort=minutes')).toEqual([ALPHA, BETA, GAMMA, OLD]);
    expect(await ids('?sort=firstSeen')).toEqual([GAMMA, ALPHA, BETA, OLD]);
    expect(await ids('?sort=activeDays')).toEqual([ALPHA, BETA, GAMMA, OLD]);
    expect(await ids('?q=v-alpha')).toEqual([ALPHA]);
    expect(await ids('?q=example.invalid')).toEqual([ALPHA]);
    expect(await ids(`?q=${encodeURIComponent(ADMIN.email)}`)).toEqual([GAMMA]);
    // '_' is a LIKE wildcard; here it only matches itself.
    expect(await ids('?q=v_')).toEqual([]);
    expect(await ids('?limit=1&offset=1')).toEqual([BETA]);
    expect(await ids('?admins=exclude')).toEqual([BETA, ALPHA, OLD]);
    expect((await list('?days=90')).visitors.find(v => v.visitorId === OLD)).toMatchObject({ minutes: 0 });
  });

  it('refuses unknown sorts and ranges', async () => {
    for (const query of ['?sort=visitor_id; DROP TABLE visitor', '?days=12', '?limit=0']) {
      expect((await kit.call(root.jar, 'GET', `/api/admin/analytics/visitors/list${query}`)).status, query).toBe(400);
    }
  });
});

describe("one browser's activity", () => {
  it('holds its signed-out time, features and hours', async () => {
    const a = await get<Record<string, unknown> & { daily: unknown[] }>(`/visitors/${ALPHA}`);
    expect(a).toMatchObject({ today: isoDay(TODAY), since: isoDay(TODAY - 10), days: 30, visitor: { visitorId: ALPHA, user: { id: beaId, email: BEA.email, name: 'Bea' } } });
    expect(a.totals).toEqual({ minutes: 8, activeDays: 2, avgMinutesPerActiveDay: 4, firstActiveDay: isoDay(TODAY - 10), lastActiveDay: isoDay(TODAY), wallDays: 0 });
    expect(a.daily).toHaveLength(30);
    expect(a.daily.at(-1)).toEqual({ day: isoDay(TODAY), minutes: 3, views: { 'view:history': 3 } });
    expect(a.daily.at(-11)).toEqual({ day: isoDay(TODAY - 10), minutes: 5, views: { 'view:map': 5 } });
    expect(a.features).toEqual([
      { feature: 'layer:flights', minutes: 5, days: 1 },
      { feature: 'view:map', minutes: 5, days: 1 },
      { feature: 'panel:layers', minutes: 4, days: 1 },
      { feature: 'panel:history', minutes: 3, days: 1 },
      { feature: 'view:history', minutes: 3, days: 1 },
    ]);
    // 4 October was a Sunday.
    expect(a.hours).toEqual([{ dow: 0, hour: 9, minutes: 5 }, { dow: 3, hour: 11, minutes: 3 }]);
  });

  it('counts the days it met the wall, and 404s for an unknown id', async () => {
    expect((await get<{ totals: { wallDays: number; minutes: number } }>(`/visitors/${BETA}`)).totals).toMatchObject({ wallDays: 1, minutes: 2 });
    expect((await kit.call(root.jar, 'GET', '/api/admin/analytics/visitors/nobody-at-all-00000')).status).toBe(404);
  });

  it("shows on the account's analytics as one of its browsers", async () => {
    const a = await get<{ browsers: Record<string, unknown>[] }>(`/users/${beaId}`);
    expect(a.browsers).toEqual([{
      visitorId: ALPHA, firstSeenAt: NOW - 10 * DAY_MS, lastSeenAt: NOW - 60_000, userAgent: MAC, referrer: 'news.example.com', landing: '/?utm_source=hn',
      linkedAt: NOW - 60_000, user: { id: beaId, email: BEA.email, name: 'Bea' }, place: null, device: null, minutes: 8, activeDays: 2,
    }]);
  });
});
