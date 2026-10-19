import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAY_MS } from '../access/usage';
import { adminKit } from '../admin/testing';
import type { IpLocator } from '../geoip/ip-location';
import { Jar, startApp, type TestApp } from '../testing/helpers';
import { rangeOf } from './range';
import { userAnalytics } from './user-analytics';
import { userList, usersQuery } from './users';

let t: TestApp;
let kit: ReturnType<typeof adminKit>;
let root: { jar: Jar; id: string };
let beaId: string;

const NOW = Date.UTC(2026, 9, 14, 12);
const TODAY = Math.floor(NOW / DAY_MS);
const BEA = { name: 'Bea', email: 'bea@example.invalid', password: 'another horse battery' };
const [ALPHA, BETA, GAMMA] = ['v-alpha-0000000001', 'v-beta-00000000002', 'v-gamma-0000000003'];
const BERLIN = { country: 'DE', region: 'Berlin', city: 'Berlin', latitude: 52.52, longitude: 13.4 };
const ISTANBUL = { country: 'TR', region: 'Istanbul', city: 'Istanbul', latitude: 41.01, longitude: 28.98 };
const NEW_YORK = { country: 'US', region: 'New York', city: 'New York', latitude: 40.71, longitude: -74.01 };
const locate: IpLocator = ip => (ip === '203.0.113.9' ? BERLIN : null);

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

/** Bea uses the map from Berlin now and Istanbul long ago; Alpha (her browser) and Beta from Istanbul and Berlin; Gamma (the admin's) from New York. */
function seed() {
  const run = (sql: string, ...rows: unknown[][]) => {
    const statement = t.db.prepare(sql);
    for (const row of rows) statement.run(...row);
  };
  run('INSERT INTO visitor (visitor_id, first_seen_at, last_seen_at, user_id) VALUES (?, ?, ?, ?)',
    [ALPHA, NOW - 10 * DAY_MS, NOW, beaId], [BETA, NOW - 3 * DAY_MS, NOW, null], [GAMMA, NOW, NOW, root.id]);
  const place = (type: string, id: string, ip: string, p: typeof BERLIN, lastSeenAt: number, minutes: number) =>
    [type, id, ip, p.country, p.region, p.city, p.latitude, p.longitude, lastSeenAt - DAY_MS, lastSeenAt, minutes];
  run(`INSERT INTO place_seen (subject_type, subject_id, ip, country, region, city, latitude, longitude, first_seen_at, last_seen_at, minutes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    place('user', beaId, '203.0.113.9', BERLIN, NOW - 60_000, 5),
    place('user', beaId, '198.51.100.4', ISTANBUL, NOW - 40 * DAY_MS, 2),
    place('user', root.id, '192.0.2.1', NEW_YORK, NOW, 1),
    place('visitor', ALPHA, '198.51.100.4', ISTANBUL, NOW - 1000, 3),
    place('visitor', ALPHA, '203.0.113.9', BERLIN, NOW - 5 * DAY_MS, 4),
    place('visitor', BETA, '203.0.113.20', BERLIN, NOW - 2000, 2),
    place('visitor', GAMMA, '192.0.2.1', NEW_YORK, NOW, 1));
  run('INSERT INTO action_count (day, subject_type, subject_id, action, count) VALUES (?, ?, ?, ?, ?)',
    [TODAY, 'user', beaId, 'search.run', 3], [TODAY - 1, 'user', beaId, 'route.plan', 1], [TODAY - 40, 'user', beaId, 'search.run', 9],
    [TODAY, 'visitor', ALPHA, 'search.run', 2], [TODAY, 'anon', 'h1', 'search.run', 1], [TODAY - 1, 'anon', 'h1', 'search.run', 1],
    [TODAY, 'user', root.id, 'ti.ask', 4], [TODAY, 'visitor', GAMMA, 'camera.open', 1]);
  run('INSERT INTO sign_in (user_id, at, ip_address) VALUES (?, ?, ?)', [beaId, NOW, '203.0.113.9']);
}

const get = async <T = Record<string, unknown>>(path: string) => {
  const res = await kit.call(root.jar, 'GET', `/api/admin/analytics${path}`);
  expect(res.status, path).toBe(200);
  return kit.json<T>(res);
};

describe('actions', () => {
  it('counts each action with its accounts and visitors, and charts the busiest per day', async () => {
    const e = await get<{ actions: unknown[]; actionDays: { day: string; counts: Record<string, number> }[] }>('/engagement');
    // Alpha is one visitor; the daily hash on two days is two visitor-days.
    expect(e.actions).toEqual([
      { action: 'search.run', count: 7, users: 1, visitors: 3 },
      { action: 'ti.ask', count: 4, users: 1, visitors: 0 },
      { action: 'camera.open', count: 1, users: 0, visitors: 1 },
      { action: 'route.plan', count: 1, users: 1, visitors: 0 },
    ]);
    expect(e.actionDays).toHaveLength(30);
    expect(e.actionDays.at(-1)!.counts).toEqual({ 'search.run': 6, 'ti.ask': 4, 'camera.open': 1, 'route.plan': 0 });
    expect(e.actionDays.at(-2)!.counts).toEqual({ 'search.run': 1, 'ti.ask': 0, 'camera.open': 0, 'route.plan': 1 });
    // Without admins, their own actions and their browser's go.
    expect((await get<{ actions: { action: string }[] }>('/engagement?admins=exclude')).actions.map(a => a.action)).toEqual(['search.run', 'route.plan']);
  });

  it('lists one account\'s and one visitor\'s actions over the range', async () => {
    expect((await get<{ actions: unknown[] }>(`/users/${beaId}`)).actions).toEqual([
      { action: 'search.run', count: 3, days: 1 }, { action: 'route.plan', count: 1, days: 1 },
    ]);
    expect((await get<{ actions: unknown[] }>(`/visitors/${ALPHA}`)).actions).toEqual([{ action: 'search.run', count: 2, days: 1 }]);
  });
});

describe('places', () => {
  it('counts accounts and visitors by country and city, with a point per visitor', async () => {
    expect((await get<{ countries: unknown[] }>('/audience')).countries).toEqual([{ country: 'DE', users: 1 }, { country: 'US', users: 1 }]);
    expect((await get<{ countries: unknown[] }>('/audience?admins=exclude')).countries).toEqual([{ country: 'DE', users: 1 }]);
    const v = await get<{ countries: unknown[]; cities: unknown[]; points: unknown[] }>('/visitors');
    expect(v.countries).toEqual([
      { country: 'DE', visitors: 2, signedIn: 1 }, { country: 'TR', visitors: 1, signedIn: 1 }, { country: 'US', visitors: 1, signedIn: 1 },
    ]);
    expect(v.cities).toEqual([
      { country: 'DE', region: 'Berlin', city: 'Berlin', visitors: 2 },
      { country: 'TR', region: 'Istanbul', city: 'Istanbul', visitors: 1 },
      { country: 'US', region: 'New York', city: 'New York', visitors: 1 },
    ]);
    // Each visitor's latest address only: Alpha is in Istanbul now.
    expect(v.points).toEqual([
      { latitude: 40.71, longitude: -74.01, visitors: 1 }, { latitude: 41.01, longitude: 28.98, visitors: 1 }, { latitude: 52.52, longitude: 13.4, visitors: 1 },
    ]);
    expect((await get<{ countries: unknown[] }>('/visitors?admins=exclude')).countries).toEqual([
      { country: 'DE', visitors: 2, signedIn: 1 }, { country: 'TR', visitors: 1, signedIn: 1 },
    ]);
  });

  it('gives each visitor its latest address and every address it used', async () => {
    const list = await get<{ visitors: { visitorId: string; place: unknown }[] }>('/visitors/list');
    expect(list.visitors.find(v => v.visitorId === ALPHA)!.place).toEqual({ ip: '198.51.100.4', country: 'TR', region: 'Istanbul', city: 'Istanbul' });
    const alpha = await get<{ visitor: { place: unknown }; places: { ip: string; minutes: number; lastSeenAt: number }[] }>(`/visitors/${ALPHA}`);
    expect(alpha.visitor.place).toMatchObject({ ip: '198.51.100.4' });
    expect(alpha.places.map(p => [p.ip, p.minutes])).toEqual([['198.51.100.4', 3], ['203.0.113.9', 4]]);
    expect(alpha.places[0]).toEqual({ ip: '198.51.100.4', ...ISTANBUL, firstSeenAt: NOW - 1000 - DAY_MS, lastSeenAt: NOW - 1000, minutes: 3 });
  });

  it('shows an account\'s addresses, its browsers\' places, and places sign-ins with the locator', async () => {
    const bea = await get<{ places: { ip: string }[]; browsers: { visitorId: string; place: { ip: string } | null }[]; signIns: { place: unknown }[] }>(`/users/${beaId}`);
    expect(bea.places.map(p => p.ip)).toEqual(['203.0.113.9', '198.51.100.4']);
    expect(bea.browsers.map(b => [b.visitorId, b.place?.ip])).toEqual([[ALPHA, '198.51.100.4']]);
    // The app under test has no locator, so sign-ins stay unplaced.
    expect(bea.signIns[0].place).toBeNull();

    const r = rangeOf({ days: 30, admins: 'include' }, NOW);
    expect(userAnalytics(t.db, beaId, r, locate)!.signIns[0]).toMatchObject({ ipAddress: '203.0.113.9', place: { country: 'DE', region: 'Berlin', city: 'Berlin' } });
    const row = userList(t.db, t.access, usersQuery.parse({}), r, NOW, locate).users.find(u => u.id === beaId)!;
    expect(row.activity).toMatchObject({ lastIp: '203.0.113.9', lastPlace: { country: 'DE', region: 'Berlin', city: 'Berlin' } });
  });
});
