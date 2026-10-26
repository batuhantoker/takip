import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAY_MS, isoDay } from '../access/usage';
import { adminKit } from '../admin/testing';
import { Jar, startApp, type TestApp } from '../testing/helpers';
import { entryPage } from './engagement-entries';

let t: TestApp;
let kit: ReturnType<typeof adminKit>;
let root: { jar: Jar; id: string };
let beaId: string;

// A Wednesday.
const NOW = Date.UTC(2026, 9, 14, 12);
const TODAY = Math.floor(NOW / DAY_MS);
const BEA = { name: 'Bea', email: 'bea@example.invalid', password: 'another horse battery' };
const at = (day: number, hour: number, seconds = 0) => day * DAY_MS + hour * 3_600_000 + seconds * 1000;

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
 * A: on the map yesterday and today from a flock-camera page, with Plate readers on but no layer switched on. B: a minute
 * from a city page, then opened sign-up; Private jets on before actions were counted. C: Bea's browser, two minutes signed out with Military switched on, then four
 * signed in. D: three minutes two days ago, today only the wall. E: read a page, no map. G: a script hopping pages.
 * R: the admin's browser, and the admin's own minutes. O: before the range.
 */
function seed() {
  const run = (sql: string, ...rows: unknown[][]) => {
    const statement = t.db.prepare(sql);
    for (const row of rows) statement.run(...row);
  };
  run('INSERT INTO visitor (visitor_id, first_seen_at, last_seen_at, user_id) VALUES (?, ?, ?, ?)',
    ['v-a', NOW, NOW, null], ['v-b', NOW, NOW, null], ['v-c', NOW, NOW, beaId], ['v-d', NOW, NOW, null], ['v-r', NOW, NOW, root.id], ['v-o', NOW, NOW, null]);
  run('INSERT INTO visitor_day (visitor_id, day, minutes, last_tick_at) VALUES (?, ?, ?, 0)',
    ['v-a', TODAY - 1, 1], ['v-a', TODAY, 5], ['v-b', TODAY, 1], ['v-c', TODAY, 2], ['v-d', TODAY - 2, 3], ['v-d', TODAY, 0], ['v-r', TODAY, 9], ['v-o', TODAY - 20, 30]);
  run('INSERT INTO visitor_feature (visitor_id, day, feature, minutes) VALUES (?, ?, ?, ?)',
    ['v-a', TODAY - 1, 'view:map', 1], ['v-a', TODAY, 'view:map', 5], ['v-a', TODAY, 'panel:none', 4], ['v-a', TODAY, 'panel:layers', 1], ['v-a', TODAY - 1, 'panel:none', 1],
    ['v-a', TODAY, 'layer:alpr', 5], ['v-a', TODAY, 'window:camera', 2],
    ['v-b', TODAY, 'view:map', 1], ['v-b', TODAY, 'panel:none', 1], ['v-b', TODAY, 'layer:flights', 1], ['v-b', TODAY - 3, 'layer:jets', 2],
    ['v-c', TODAY, 'view:map', 2], ['v-c', TODAY, 'layer:military', 2],
    ['v-d', TODAY - 2, 'view:map', 3], ['v-d', TODAY, 'view:wall', 7],
    ['v-r', TODAY, 'view:map', 9]);
  run('INSERT INTO visitor_hour (visitor_id, day, hour, minutes) VALUES (?, ?, ?, ?)', ['v-a', TODAY, 10, 5], ['v-b', TODAY, 9, 1], ['v-r', TODAY, 11, 9]);
  run('INSERT INTO map_time (day, subject_type, subject_id, minutes, last_tick_at) VALUES (?, ?, ?, ?, 0)',
    [TODAY, 'user', beaId, 4], [TODAY, 'user', root.id, 7], [TODAY, 'anon', 'block-hash', 50]);
  run('INSERT INTO feature_time (day, subject_type, subject_id, feature, minutes) VALUES (?, ?, ?, ?, ?)',
    [TODAY, 'user', beaId, 'view:map', 4], [TODAY, 'user', beaId, 'panel:history', 4], [TODAY, 'user', beaId, 'layer:military', 4],
    [TODAY, 'user', root.id, 'view:map', 7], [TODAY, 'anon', 'block-hash', 'view:map', 50]);
  run('INSERT INTO user_hour (user_id, day, hour, minutes) VALUES (?, ?, ?, ?)', [beaId, TODAY, 12, 4], [root.id, TODAY, 12, 7]);
  run('INSERT INTO action_count (day, subject_type, subject_id, action, count) VALUES (?, ?, ?, ?, ?)',
    [TODAY, 'visitor', 'v-a', 'camera.open', 3], [TODAY, 'visitor', 'v-a', 'search.run', 4], [TODAY, 'visitor', 'v-a', 'search.pick', 1],
    [TODAY, 'visitor', 'v-b', 'account.sign_up_open', 1], [TODAY, 'visitor', 'v-c', 'layer.on', 1], [TODAY, 'user', beaId, 'camera.open', 2],
    [TODAY, 'visitor', 'v-r', 'camera.open', 5], [TODAY, 'anon', 'block-hash', 'camera.open', 9]);
  run(`INSERT INTO page_view (visitor_id, at, day, path, locale, referrer, browser, os, device) VALUES (?, ?, ?, ?, 'en', '', 'Chrome', 'macOS', ?)`,
    ['v-a', at(TODAY, 10), TODAY, '/city/berlin/flock-cameras', 'mobile'], ['v-a', at(TODAY, 10, 60), TODAY, '/', 'mobile'],
    ['v-b', at(TODAY, 9), TODAY, '/city/paris', 'desktop'], ['v-b', at(TODAY, 9, 300), TODAY, '/', 'desktop'],
    ['v-c', at(TODAY, 8), TODAY, '/compare/a-vs-b/gdp', 'desktop'],
    ['v-d', at(TODAY, 11), TODAY, '/', 'desktop'],
    ['v-e', at(TODAY, 7), TODAY, '/compare/x-vs-y', 'mobile'],
    ['v-g', at(TODAY, 6), TODAY, '/city/rome', 'desktop'], ['v-g', at(TODAY, 6, 1), TODAY, '/city/oslo', 'desktop'],
    ['v-r', at(TODAY, 11), TODAY, '/', 'desktop']);
}

type Engagement = {
  totals: Record<string, number | null>;
  funnel: Record<string, number>;
  length: { bucket: string; people: number }[];
  daily: { day: string; people: number; minutes: number }[];
  entries: { sections: { page: string; people: number; openedMap: number; medianMapMinutes: number | null }[]; pages: { page: string }[] };
  features: { feature: string; minutes: number; users: number; visitors: number; people: number; medianMinutes: number | null; arrivedOn?: number }[];
  actions: { action: string; count: number; users: number; visitors: number; people: number; medianUses: number | null }[];
  hours: { dow: number; hour: number; minutes: number }[];
  topUsers: { email: string; minutes: number }[];
  viewsSince: string | null;
};

const get = async (query: string) => {
  const res = await kit.call(root.jar, 'GET', `/api/admin/analytics/engagement?${query}`);
  expect(res.status).toBe(200);
  return kit.json<Engagement>(res);
};

describe('engagement', () => {
  it('counts people, not address blocks: a browser signed in is its account, the wall and scripts apart', async () => {
    const e = await get('days=7&admins=exclude');
    expect(e.totals).toEqual({ people: 4, visitors: 4, accounts: 1, minutes: 16, medianMinutes: 4.5, leftWithinMinute: 1 });
    expect(e.funnel).toEqual({ arrived: 5, openedMap: 4, stayed: 3, cameBack: 1, signUpOpened: 1, signedUp: 1 });
    expect(e.length.filter(b => b.people)).toEqual([{ bucket: 'Under 1 min', people: 1 }, { bucket: '2–5 min', people: 1 }, { bucket: '5–15 min', people: 2 }]);
    expect(e.daily.at(-1)).toEqual({ day: isoDay(TODAY), people: 3, minutes: 12 });
    expect(e.viewsSince).toBe(isoDay(TODAY));
  });

  it('ranks features by people with each one’s median, and tells layers that came on by themselves', async () => {
    const { features } = await get('days=7&admins=exclude');
    const of = (name: string) => features.find(f => f.feature === name);
    expect(features[0]).toEqual({ feature: 'view:map', minutes: 16, users: 1, visitors: 4, people: 4, medianMinutes: 4.5 });
    expect(of('view:wall')).toMatchObject({ people: 1, minutes: 7, medianMinutes: 7 });
    expect(of('layer:alpr')).toMatchObject({ people: 1, arrivedOn: 1 });
    // No action was counted yet that day, so it can't say the layer came by itself.
    expect(of('layer:jets')).toMatchObject({ people: 1, arrivedOn: 0 });
    // Bea switched it on signed out, so her signed-in minutes with it are a choice too.
    expect(of('layer:military')).toMatchObject({ people: 1, visitors: 1, users: 1, minutes: 6, medianMinutes: 6, arrivedOn: 0 });
    expect(of('panel:none')).toMatchObject({ people: 2, minutes: 6 });
  });

  it('counts actions per person, browsers with an id and accounts only', async () => {
    const { actions } = await get('days=7&admins=exclude');
    expect(actions.find(a => a.action === 'camera.open')).toEqual({ action: 'camera.open', count: 5, users: 1, visitors: 1, people: 2, medianUses: 2.5 });
    expect(actions.map(a => a.action).sort()).toEqual(['account.sign_up_open', 'camera.open', 'layer.on', 'search.pick', 'search.run']);
  });

  it('says where each person came in and what share went on to the map', async () => {
    const { entries } = await get('days=7&admins=exclude');
    expect(entries.sections).toEqual([
      { page: '/city', people: 2, openedMap: 2, medianMapMinutes: 3.5 },
      { page: '/compare', people: 2, openedMap: 1, medianMapMinutes: 6 },
      { page: '/', people: 1, openedMap: 1, medianMapMinutes: 3 },
    ]);
    expect(entries.pages.map(p => p.page)).toEqual(['/', '/city/*', '/city/*/flock-cameras', '/compare/*', '/compare/*/gdp']);
  });

  it('builds the week from browsers and accounts, leaving the admin out', async () => {
    const e = await get('days=7&admins=exclude');
    expect(e.hours).toEqual([{ dow: 3, hour: 9, minutes: 1 }, { dow: 3, hour: 10, minutes: 5 }, { dow: 3, hour: 12, minutes: 4 }]);
    expect(e.topUsers.map(u => [u.email, u.minutes])).toEqual([['bea@example.invalid', 4]]);
  });

  it('counts the admin as one more person when admins are in', async () => {
    const e = await get('days=7');
    expect(e.totals).toMatchObject({ people: 5, visitors: 5, accounts: 2, minutes: 32 });
    expect(e.funnel).toMatchObject({ arrived: 6, signedUp: 2 });
    expect(e.actions.find(a => a.action === 'camera.open')).toMatchObject({ people: 3, count: 10 });
  });

  it('names a page by its kind: the place, event or pair starred, a layer page or guide kept', () => {
    expect(entryPage('/city/berlin/cameras')).toBe('/city/*/cameras');
    expect(entryPage('/compare/greece-vs-turkey')).toBe('/compare/*');
    expect(entryPage('/map/live-news')).toBe('/map/live-news');
    expect(entryPage('/guides/flight-tracking')).toBe('/guides/flight-tracking');
    expect(entryPage('/about')).toBe('/about');
    expect(entryPage('/')).toBe('/');
  });
});
