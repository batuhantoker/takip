import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAY_MS } from '../access/usage';
import { adminKit } from '../admin/testing';
import { Jar, startApp, type TestApp } from '../testing/helpers';

let t: TestApp;
let kit: ReturnType<typeof adminKit>;
let root: { jar: Jar; id: string };
let beaId: string;

const NOW = Date.UTC(2026, 9, 14, 12);
const BEA = { name: 'Bea', email: 'bea@example.invalid', password: 'another horse battery' };
const [ALPHA, BETA, GAMMA] = ['v-alpha-0000000001', 'v-beta-00000000002', 'v-gamma-0000000003'];
const ANKARA = { latitude: 39.93, longitude: 32.85, accuracyM: 30, label: 'Çankaya, Ankara, Türkiye' };

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

/** Bea and Alpha (her browser) shared Ankara while their addresses read Istanbul; Beta shared long ago; Gamma is the admin's. */
function seed() {
  const run = (sql: string, ...rows: unknown[][]) => {
    const statement = t.db.prepare(sql);
    for (const row of rows) statement.run(...row);
  };
  run('INSERT INTO visitor (visitor_id, first_seen_at, last_seen_at, user_id) VALUES (?, ?, ?, ?)',
    [ALPHA, NOW - 10 * DAY_MS, NOW, beaId], [BETA, NOW - 50 * DAY_MS, NOW, null], [GAMMA, NOW, NOW, root.id]);
  run(`INSERT INTO place_seen (subject_type, subject_id, ip, country, region, city, latitude, longitude, first_seen_at, last_seen_at, minutes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['visitor', ALPHA, '198.51.100.4', 'TR', 'Istanbul', 'Istanbul', 41.01, 28.98, NOW - DAY_MS, NOW - 1000, 3],
    ['visitor', BETA, '203.0.113.20', 'DE', 'Berlin', 'Berlin', 52.52, 13.4, NOW - DAY_MS, NOW - 2000, 2],
    ['visitor', GAMMA, '192.0.2.1', 'US', 'New York', 'New York', 40.71, -74.01, NOW, NOW, 1]);
  const device = (type: string, id: string, lat: number, lon: number, accuracy: number | null, label: string | null, lastSeenAt: number, fixes: number) =>
    [type, id, lat, lon, accuracy, label, lastSeenAt - DAY_MS, lastSeenAt, fixes];
  run(`INSERT INTO device_place (subject_type, subject_id, latitude, longitude, accuracy_m, label, first_seen_at, last_seen_at, fixes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    device('user', beaId, ANKARA.latitude, ANKARA.longitude, 30, ANKARA.label, NOW - 60_000, 4),
    device('user', beaId, 38.42, 27.14, 900, null, NOW - 5 * DAY_MS, 1),
    device('visitor', ALPHA, ANKARA.latitude, ANKARA.longitude, 30, ANKARA.label, NOW - 1000, 2),
    device('visitor', BETA, 48.86, 2.35, 50, 'Paris, France', NOW - 40 * DAY_MS, 1),
    device('visitor', GAMMA, 40.75, -73.99, 10, 'New York, United States', NOW, 1));
}

const get = async <T = Record<string, unknown>>(path: string) => {
  const res = await kit.call(root.jar, 'GET', `/api/admin/analytics${path}`);
  expect(res.status, path).toBe(200);
  return kit.json<T>(res);
};

describe('shared locations', () => {
  it("lists an account's shared locations and shows the latest on its row and its browsers", async () => {
    const bea = await get<{ devicePlaces: unknown[]; browsers: { visitorId: string; device: unknown }[] }>(`/users/${beaId}`);
    expect(bea.devicePlaces).toEqual([
      { ...ANKARA, firstSeenAt: NOW - 60_000 - DAY_MS, lastSeenAt: NOW - 60_000, fixes: 4 },
      { latitude: 38.42, longitude: 27.14, accuracyM: 900, label: null, firstSeenAt: NOW - 6 * DAY_MS, lastSeenAt: NOW - 5 * DAY_MS, fixes: 1 },
    ]);
    expect(bea.browsers).toMatchObject([{ visitorId: ALPHA, device: { ...ANKARA, at: NOW - 1000 } }]);
    const users = await kit.json<{ users: { id: string; activity: { lastDevice: unknown } }[] }>(await kit.call(root.jar, 'GET', '/api/admin/users'));
    expect(users.users.find(u => u.id === beaId)!.activity.lastDevice).toEqual({ ...ANKARA, at: NOW - 60_000 });
    expect(users.users.find(u => u.id === root.id)!.activity.lastDevice).toBeNull();
  });

  it("gives each visitor its latest shared location, and lists them all on its page", async () => {
    const list = await get<{ visitors: { visitorId: string; device: unknown }[] }>('/visitors/list');
    expect(list.visitors.find(v => v.visitorId === ALPHA)!.device).toEqual({ ...ANKARA, at: NOW - 1000 });
    expect(list.visitors.find(v => v.visitorId === BETA)!.device).toMatchObject({ label: 'Paris, France' });
    const alpha = await get<{ visitor: { device: unknown }; devicePlaces: unknown[] }>(`/visitors/${ALPHA}`);
    expect(alpha.visitor.device).toEqual({ ...ANKARA, at: NOW - 1000 });
    expect(alpha.devicePlaces).toEqual([{ ...ANKARA, firstSeenAt: NOW - 1000 - DAY_MS, lastSeenAt: NOW - 1000, fixes: 2 }]);
  });

  it("puts a visitor on the map where they shared, else where their address is, within the range", async () => {
    // Alpha shared Ankara (its address reads Istanbul); Beta's share is older than the range, so its address counts.
    expect((await get<{ points: unknown[] }>('/visitors')).points).toEqual([
      { latitude: 39.93, longitude: 32.85, visitors: 1 }, { latitude: 40.75, longitude: -73.99, visitors: 1 }, { latitude: 52.52, longitude: 13.4, visitors: 1 },
    ]);
    expect((await get<{ points: unknown[] }>('/visitors?admins=exclude')).points).toEqual([
      { latitude: 39.93, longitude: 32.85, visitors: 1 }, { latitude: 52.52, longitude: 13.4, visitors: 1 },
    ]);
  });
});
