import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAY_MS } from '../access/usage';
import { adminKit } from '../admin/testing';
import { Jar, startApp, type TestApp } from '../testing/helpers';
import { groupVisits, type Visit } from './page-visits';

const NOW = Date.UTC(2026, 9, 14, 12);
const MIN = 60_000;
const CHROME = 'Mozilla/5.0 (Macintosh) Chrome/141.0';
const [ALPHA, BETA, GAMMA] = ['v-alpha-0000000001', 'v-beta-00000000002', 'v-gamma-0000000003'];

const row = (visitorId: string, at: number, path: string, over: { referrer?: string; fromPath?: string | null; campaign?: string } = {}) => ({
  visitorId, at, path, locale: 'en', referrer: over.referrer ?? '', fromPath: over.fromPath ?? null, campaign: over.campaign ?? null,
  country: 'DE', region: null, city: 'Berlin', latitude: 52.52, longitude: 13.4, browser: 'Chrome', os: 'macOS', device: 'desktop',
  known: 0, userId: null, email: null, referrerPath: null, mapSince: null, priorAt: null,
});
const shape = (v: Visit) => ({ origin: v.origin, steps: v.steps.map(s => s.path), views: v.views, next: v.next, returning: v.returning });

describe('grouping views into visits', () => {
  it('follows one browser from the site that sent it to the map, folding reloads', () => {
    const visits = groupVisits([
      row(ALPHA, NOW, '/city/berlin', { referrer: 'www.google.com' }),
      row(ALPHA, NOW + MIN, '/city/berlin', { referrer: 'www.google.com', fromPath: '/city/berlin' }),
      row(ALPHA, NOW + 2 * MIN, '/city/berlin/weather', { referrer: 'www.google.com', fromPath: '/city/berlin' }),
      row(ALPHA, NOW + 3 * MIN, '/', { fromPath: '/city/berlin/weather' }),
    ]);
    expect(visits.map(shape)).toEqual([{ origin: 'www.google.com', steps: ['/city/berlin', '/city/berlin/weather', '/'], views: 4, next: 'page', returning: false }]);
    expect(visits[0]).toMatchObject({ source: 'Google', channel: 'search' });
  });

  it('starts another after half an hour, when another site sends the browser in, and for each browser', () => {
    const visits = groupVisits([
      row(ALPHA, NOW, '/about'),
      row(ALPHA, NOW + 31 * MIN, '/about'),
      row(ALPHA, NOW + 32 * MIN, '/guides/x', { referrer: 'news.ycombinator.com' }),
      row(ALPHA, NOW + 33 * MIN, '/', { referrer: 'news.ycombinator.com', fromPath: '/guides/x' }),
      row(BETA, NOW + 33 * MIN, '/map/ships'),
    ]);
    expect(visits.map(shape)).toEqual([
      { origin: null, steps: ['/about'], views: 1, next: 'left', returning: false },
      { origin: null, steps: ['/about'], views: 1, next: 'left', returning: true },
      { origin: 'news.ycombinator.com', steps: ['/guides/x', '/'], views: 2, next: 'map', returning: true },
      { origin: null, steps: ['/map/ships'], views: 1, next: 'left', returning: false },
    ]);
  });

  it('counts a browser as returning when it read before the range or used the map before', () => {
    const [before, map, fresh] = groupVisits([
      { ...row(ALPHA, NOW, '/about'), priorAt: NOW - 3 * DAY_MS },
      { ...row(BETA, NOW, '/about'), mapSince: NOW - DAY_MS },
      { ...row(GAMMA, NOW, '/about'), mapSince: NOW + MIN },
    ]);
    expect([before.returning, map.returning, fresh.returning]).toEqual([true, true, false]);
  });
});

describe('visits in admin', () => {
  let t: TestApp;
  let kit: ReturnType<typeof adminKit>;
  let root: { jar: Jar; id: string };
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    t = await startApp();
    kit = adminKit(t);
    root = await kit.admin();
    const log = t.db.prepare(`
      INSERT INTO page_view (visitor_id, at, day, path, locale, referrer, from_path, campaign, country, region, city, browser, os, device)
      VALUES (?, ?, ?, ?, 'en', ?, ?, ?, ?, NULL, NULL, 'Chrome', 'macOS', ?)`);
    const at = (minutesAgo: number) => NOW - minutesAgo * MIN;
    const day = (ms: number) => Math.floor(ms / DAY_MS);
    // Alpha: Google → Berlin → the map. Beta: Google → Berlin, then left. Gamma (the admin): straight to the map.
    for (const [id, ago, path, referrer, from, campaign, country, device] of [
      [ALPHA, 50, '/city/berlin', 'www.google.com', null, 'newsletter', 'DE', 'mobile'],
      [ALPHA, 48, '/', '', '/city/berlin', null, 'DE', 'mobile'],
      [BETA, 20, '/city/berlin', 'www.google.com', null, null, 'FR', 'desktop'],
      [GAMMA, 5, '/', '', null, null, 'US', 'desktop'],
    ] as const) log.run(id, at(ago), day(at(ago)), path, referrer, from, campaign, country, device);
    t.db.prepare('INSERT INTO visitor (visitor_id, first_seen_at, last_seen_at, user_id, linked_at) VALUES (?, ?, ?, ?, ?)').run(GAMMA, NOW, NOW, root.id, NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    t.close();
  });

  const get = async <T>(path: string) => {
    const res = await kit.call(root.jar, 'GET', `/api/admin/analytics${path}`);
    expect(res.status, path).toBe(200);
    return kit.json<T>(res);
  };

  it('shows where each origin led', async () => {
    const { journeys } = await get<{ journeys: Record<string, unknown> }>('/pages');
    expect(journeys.totals).toEqual({
      visitors: 3, new: 3, readers: 2, mapUsers: 2, both: 1, signedIn: 1, minutes: 0, pageMapMinutes: 0, pageMapUsers: 0,
      visits: 3, views: 4, left: 2, readOn: 0, toMap: 1, landedOnMap: 1, returning: 0, avgSteps: 4 / 3, medianMs: 2 * MIN,
    });
    expect(journeys.flow).toEqual([
      { origin: 'Google', landing: '/city/berlin', next: 'map', visits: 1 },
      { origin: 'Google', landing: '/city/berlin', next: 'left', visits: 1 },
      { origin: null, landing: '/', next: 'left', visits: 1 },
    ]);
    expect(journeys.channels).toEqual([{ channel: 'search', visits: 2 }, { channel: 'direct', visits: 1 }]);
    expect(journeys.sources).toEqual([{ source: 'Google', channel: 'search', hosts: ['www.google.com'], visits: 2 }]);
    expect(journeys.pages).toEqual([
      { path: '/', visits: 2, landings: 1, exits: 2, medianMs: null, mapMinutes: 0, mapUsers: 0 },
      { path: '/city/berlin', visits: 2, landings: 2, exits: 1, medianMs: 2 * MIN, mapMinutes: 0, mapUsers: 0 },
    ]);
    expect(journeys.steps).toEqual([{ from: '/city/berlin', to: '/', visits: 1 }]);
    expect(journeys.campaigns).toEqual([{ campaign: 'newsletter', visits: 1 }]);
    expect(journeys.devices).toEqual([{ device: 'desktop', visits: 2 }, { device: 'mobile', visits: 1 }]);
  });

  it('keeps to a window of hours, counted per hour', async () => {
    const early = NOW - 7 * 60 * MIN;
    t.db.prepare(`INSERT INTO page_view (visitor_id, at, day, path, locale, referrer, browser, os, device) VALUES (?, ?, ?, '/about', 'en', '', 'Chrome', 'macOS', 'desktop')`)
      .run('v-delta-0000000004', early, Math.floor(early / DAY_MS));
    type Journeys = { journeys: { totals: { visitors: number }; series: Record<string, number>[] } };
    expect((await get<Journeys>('/pages?days=7')).journeys.totals.visitors).toBe(4);
    const { journeys } = await get<Journeys>('/pages?hours=6');
    expect(journeys.totals.visitors).toBe(3);
    expect(journeys.series.map(b => b.at)).toEqual(Array.from({ length: 7 }, (_, i) => NOW - (6 - i) * 60 * MIN));
    expect(journeys.series[5]).toEqual({ at: NOW - 60 * MIN, visitors: 3, readers: 2, mapUsers: 2, visits: 3, minutes: 0, pageMapMinutes: 0 });
    expect((await get<{ total: number }>('/pages/visits?hours=6')).total).toBe(3);
  });

  it('counts days in the viewer’s time zone', async () => {
    const view = t.db.prepare(`INSERT INTO page_view (visitor_id, at, day, path, locale, referrer, browser, os, device) VALUES (?, ?, ?, '/about', 'en', '', 'Chrome', 'macOS', 'desktop')`);
    // 22:00 on the 13th in New York; 05:00 on the 8th in Tokyo, a day before the UTC range begins.
    for (const [id, at] of [['v-delta-0000000004', Date.UTC(2026, 9, 14, 2)], ['v-epsilon-00000005', Date.UTC(2026, 9, 7, 20)]] as const) view.run(id, at, Math.floor(at / DAY_MS));
    type Journeys = { journeys: { series: { at: number; visits: number }[] } };
    const series = async (tz: string) => (await get<Journeys>(`/pages?days=7&tz=${encodeURIComponent(tz)}`)).journeys.series;
    expect((await series('UTC')).map(b => b.visits)).toEqual([0, 0, 0, 0, 0, 0, 4]);
    expect((await series('America/New_York')).map(b => b.visits)).toEqual([0, 0, 0, 0, 0, 1, 3]);
    const tokyo = await series('Asia/Tokyo');
    expect(tokyo.map(b => b.visits)).toEqual([1, 0, 0, 0, 0, 0, 4]);
    expect(tokyo[0].at).toBe(Date.UTC(2026, 9, 7, 15));
    expect((await kit.call(root.jar, 'GET', '/api/admin/analytics/pages?tz=Mars%2FOlympus')).status).toBe(400);
  });

  it('counts time on the full map and on the pages’ small maps by the hour', async () => {
    const hour = (ago: number) => {
      const at = NOW - ago * 60 * MIN;
      return [Math.floor(at / DAY_MS), new Date(at).getUTCHours()] as const;
    };
    // An hour ago: 12 signed-out minutes, 5 of an account's; eight hours ago, outside six: 30 more signed out.
    t.db.prepare("INSERT INTO activity_hour (day, hour, subject_type, minutes) VALUES (?, ?, 'anon', ?)").run(...hour(1), 12);
    t.db.prepare("INSERT INTO activity_hour (day, hour, subject_type, minutes) VALUES (?, ?, 'anon', ?)").run(...hour(8), 30);
    t.db.prepare('INSERT INTO user_hour (user_id, day, hour, minutes) VALUES (?, ?, ?, ?)').run('u-reader', ...hour(1), 5);
    const page = t.db.prepare('INSERT INTO page_map_minute (visitor_id, day, hour, path, minutes, last_at) VALUES (?, ?, ?, ?, ?, ?)');
    page.run(ALPHA, ...hour(1), '/city/berlin', 3, NOW);
    page.run(BETA, ...hour(1), '/city/berlin', 1, NOW);
    type Journeys = { journeys: { totals: Record<string, number>; series: Record<string, number>[]; pages: Record<string, unknown>[] } };
    const { journeys } = await get<Journeys>('/pages?hours=6');
    expect(journeys.totals).toMatchObject({ minutes: 17, pageMapMinutes: 4, pageMapUsers: 2 });
    expect(journeys.series[5]).toMatchObject({ minutes: 17, pageMapMinutes: 4 });
    expect(journeys.pages.find(p => p.path === '/city/berlin')).toMatchObject({ mapMinutes: 4, mapUsers: 2 });
    expect((await get<Journeys>('/pages?days=7')).journeys.totals.minutes).toBe(47);
  });

  it('lists only the browsers seen in the range', async () => {
    t.db.prepare('INSERT INTO visitor (visitor_id, first_seen_at, last_seen_at) VALUES (?, ?, ?)').run('v-old-000000000005', NOW - 10 * DAY_MS, NOW - 10 * DAY_MS);
    expect((await get<{ total: number }>('/visitors/list?days=30')).total).toBe(2);
    expect((await get<{ total: number }>('/visitors/list?days=7')).total).toBe(1);
  });

  it('shows one page: where its readers came from, where they went and how long they stayed', async () => {
    const page = await get<Record<string, unknown>>('/pages/page?path=%2Fcity%2Fberlin');
    expect(page).toMatchObject({ path: '/city/berlin', visits: 2, landings: 2, exits: 1, medianMs: 2 * MIN });
    expect(page.cameFrom).toEqual([{ from: 'origin:Google', visits: 2 }]);
    expect(page.wentTo).toEqual([{ to: '', visits: 1 }, { to: '/', visits: 1 }]);
  });

  it('lists the latest visits, narrowed by origin, page, country or what came next', async () => {
    type List = { total: number; visits: { visitorId: string; steps: { path: string }[]; known: boolean; user: { email: string } | null }[] };
    const all = await get<List>('/pages/visits');
    expect(all.visits.map(v => v.visitorId)).toEqual([GAMMA, BETA, ALPHA]);
    expect(all.visits[0]).toMatchObject({ known: true, user: { email: expect.any(String) } });
    expect((await get<List>('/pages/visits?origin=direct')).visits.map(v => v.visitorId)).toEqual([GAMMA]);
    expect((await get<List>('/pages/visits?origin=www.google.com&next=map')).visits.map(v => v.visitorId)).toEqual([ALPHA]);
    expect((await get<List>('/pages/visits?origin=Google')).visits.map(v => v.visitorId)).toEqual([BETA, ALPHA]);
    expect((await get<List>('/pages/visits?channel=direct')).visits.map(v => v.visitorId)).toEqual([GAMMA]);
    expect((await get<List>('/pages/visits?page=%2Fcity%2Fberlin&country=FR')).visits.map(v => v.visitorId)).toEqual([BETA]);
    expect((await get<List>('/pages/visits?admins=exclude')).total).toBe(2);
    expect((await get<List>('/pages/visits?limit=1&offset=1')).visits.map(v => v.visitorId)).toEqual([BETA]);
  });

  it('shows who is here now, on the map or a page, and marks the admin', async () => {
    const send = (path: string, body: object) => t.app.request(path, {
      method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': CHROME }, body: JSON.stringify(body),
    });
    await send('/api/v1/page-view', { visitor: { id: BETA, referrer: 'www.google.com' }, path: '/city/berlin', locale: 'en' });
    await send('/api/v1/me/time', { features: ['view:map', 'panel:layers', 'layer:flights'], visitor: { id: ALPHA }, actions: { 'camera.open': 2, 'search.run': 1 } });
    await kit.call(root.jar, 'POST', '/api/v1/page-view', { visitor: { id: GAMMA }, path: '/about', locale: 'en' });

    type Live = { people: { key: string; kind: string; path: string; features: string[]; referrer: string | null; admin: boolean }[] };
    const now = await get<Live>('/live');
    expect(now.people.map(p => ({ key: p.key, kind: p.kind, path: p.path, features: p.features, referrer: p.referrer, admin: p.admin }))).toEqual([
      { key: BETA, kind: 'page', path: '/city/berlin', features: [], referrer: 'www.google.com', admin: false },
      { key: ALPHA, kind: 'map', path: '/', features: ['view:map', 'panel:layers', 'layer:flights'], referrer: null, admin: false },
      { key: GAMMA, kind: 'page', path: '/about', features: [], referrer: null, admin: true },
    ]);
    expect((await get<Live & { people: { actions: { action: string }[] }[] }>('/live')).people[1].actions.map(a => a.action)).toEqual(['camera.open', 'search.run']);
    expect((await get<Live>('/live?admins=exclude')).people.map(p => p.key)).toEqual([BETA, ALPHA]);

    vi.setSystemTime(NOW + 4 * MIN);
    expect((await get<Live>('/live')).people.map(p => p.key)).toEqual([BETA, GAMMA]);
    vi.setSystemTime(NOW + 6 * MIN);
    expect((await get<Live>('/live')).people).toEqual([]);
  });

  it('is behind the gate', async () => {
    const user = await t.signUpVerified(new Jar(), { name: 'Cy', email: 'cy@example.invalid', password: 'another horse battery' });
    await kit.expectGated('GET', '/api/admin/analytics/live', user);
    await kit.expectGated('GET', '/api/admin/analytics/pages/visits', user);
  });
});
