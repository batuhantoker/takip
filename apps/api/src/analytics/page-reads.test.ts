import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAY_MS, isoDay } from '../access/usage';
import { adminKit } from '../admin/testing';
import { Jar, startApp, type TestApp } from '../testing/helpers';
import { openAppDb } from '../db/app-db';
import { migrateAppSchema } from '../db/migrations';
import { createPageReads, parseMapMinute, parsePageRead, SMALL_MAP_FEATURE } from './page-reads';
import { createPresence } from './presence';

const NOW = Date.UTC(2026, 9, 14, 12);
const TODAY = Math.floor(NOW / DAY_MS);
const CHROME = 'Mozilla/5.0 (Macintosh) Chrome/141.0';
const [ALPHA, BETA, GAMMA] = ['v-alpha-0000000001', 'v-beta-00000000002', 'v-gamma-0000000003'];
const from = (remoteAddress: string) => ({ incoming: { socket: { remoteAddress } } });

describe('a view report', () => {
  const body = (over: object = {}) => ({ visitor: { id: ALPHA, referrer: 'www.Google.com' }, path: '/city/cincinnati/transit', locale: 'tr', ...over });

  it('keeps the page, its language, the site that sent the reader and the page before it', () => {
    expect(parsePageRead(body({ from: '/guides/how-to-track-a-flight-live' }), CHROME)).toEqual({
      visitorId: ALPHA, path: '/city/cincinnati/transit', locale: 'tr', referrer: 'www.google.com', referrerPath: null,
      from: '/guides/how-to-track-a-flight-live', campaign: null, userAgent: CHROME,
    });
    expect(parsePageRead(body({ visitor: { id: ALPHA } }), CHROME)?.referrer).toBe('');
    expect(parsePageRead(body({ from: '/admin/users' }), CHROME)?.from).toBeNull();
  });

  it('keeps the linking page for social and other sites, never a search or an AI chat', () => {
    const linked = (referrer: string, referrerPath: string) => parsePageRead(body({ visitor: { id: ALPHA, referrer }, referrerPath }), CHROME)?.referrerPath;
    expect(linked('old.reddit.com', '/r/maps/comments/abc123/live_flights/')).toBe('/r/maps/comments/abc123/live_flights/');
    expect(linked('someblog.example', '/2026/10/maps')).toBe('/2026/10/maps');
    expect(linked('www.google.com', '/search')).toBeNull();
    expect(linked('chatgpt.com', '/c/6801-private')).toBeNull();
    expect(linked('someblog.example', '/')).toBeNull();
    expect(linked('someblog.example', '/a b')).toBeNull();
  });

  it('takes the campaign from the address it opened with', () => {
    const campaign = (landing: string) => parsePageRead(body({ visitor: { id: ALPHA, landing } }), CHROME)?.campaign;
    expect(campaign('/city/cincinnati?utm_source=Newsletter&utm_medium=email')).toBe('newsletter');
    expect(campaign('/city/cincinnati?ref=hn')).toBe('hn');
    expect(campaign('/city/cincinnati?token=secret')).toBeNull();
    expect(campaign('/city/cincinnati')).toBeNull();
  });

  it('takes every public section, new ones included', () => {
    for (const path of ['/town/frederick-md/flock-cameras', '/event/1906-san-francisco-earthquake', '/compare/greece-vs-turkey/life-expectancy', '/ramadan', '/westminster'])
      expect(parsePageRead(body({ path }), CHROME)?.path, path).toBe(path);
  });

  it('takes the map opening as well, by its path /', () => {
    expect(parsePageRead(body({ path: '/', from: '/city/cincinnati/transit' }), CHROME)).toMatchObject({ path: '/', from: '/city/cincinnati/transit' });
  });

  it('drops anything that is not a reader on a public page', () => {
    expect(parsePageRead(body(), 'Mozilla/5.0 (compatible; Googlebot/2.1)')).toBeNull();
    for (const path of ['/admin', '/admin/users', '/docs/api', '/w/abc', '/city/a/b/c', '/city/Cincinnati', '/docs', '/city/x?token=1', '//']) expect(parsePageRead(body({ path }), CHROME), path).toBeNull();
    expect(parsePageRead(body({ locale: 'xx' }), CHROME)).toBeNull();
    expect(parsePageRead(body({ visitor: { id: 'short' } }), CHROME)).toBeNull();
    expect(parsePageRead(null, CHROME)).toBeNull();
  });
});

describe('reading the public pages', () => {
  let t: TestApp;
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    t = await startApp();
  });
  afterEach(() => {
    vi.useRealTimers();
    t.close();
  });

  const view = (visitor: object, path: string, locale = 'en') => t.app.request('/api/v1/page-view', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': CHROME },
    body: JSON.stringify({ visitor, path, locale }),
  }, from('203.0.113.5'));
  const rows = () => t.db.prepare('SELECT visitor_id AS id, day, path, locale, referrer, views FROM page_read ORDER BY path, locale').all();

  it('counts each view without touching map time, and drops what it can’t use', async () => {
    expect((await view({ id: ALPHA, referrer: 'www.google.com' }, '/city/cincinnati/transit', 'tr')).status).toBe(204);
    await view({ id: ALPHA, referrer: 'www.google.com' }, '/city/cincinnati/transit', 'tr');
    await view({ id: ALPHA }, '/guides/how-to-track-a-flight-live');
    expect((await view({ id: ALPHA }, '/admin')).status).toBe(204);
    expect(rows()).toEqual([
      { id: ALPHA, day: TODAY, path: '/city/cincinnati/transit', locale: 'tr', referrer: 'www.google.com', views: 2 },
      { id: ALPHA, day: TODAY, path: '/guides/how-to-track-a-flight-live', locale: 'en', referrer: '', views: 1 },
    ]);
    expect(t.db.prepare('SELECT count(*) FROM map_time').pluck().get()).toBe(0);
    expect(t.db.prepare('SELECT count(*) FROM visitor').pluck().get()).toBe(0);
  });

  it('drops a view from a Chromium whose hints contradict its user agent', async () => {
    const send = (platform: string) => t.app.request('/api/v1/page-view', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': CHROME, 'sec-ch-ua-platform': platform },
      body: JSON.stringify({ visitor: { id: ALPHA }, path: '/about', locale: 'en' }),
    }, from('203.0.113.5'));
    expect((await send('"Linux"')).status).toBe(204);
    expect(rows()).toEqual([]);
    await send('"macOS"');
    expect(rows()).toHaveLength(1);
  });

  it('counts a page reloaded over and over 50 times a day at most', async () => {
    for (let i = 0; i < 55; i++) await view({ id: BETA }, '/map/earthquakes');
    expect(rows()).toMatchObject([{ path: '/map/earthquakes', views: 50 }]);
  });

  const logged = () => t.db.prepare('SELECT visitor_id AS id, at, path, referrer, from_path AS fromPath, browser, os, device FROM page_view ORDER BY view_id').all();

  it('logs each view in order with the browser it came from, and the map’s opening without counting it as a page', async () => {
    await view({ id: ALPHA, referrer: 'www.google.com' }, '/city/cincinnati/transit');
    vi.setSystemTime(NOW + 60_000);
    await view({ id: ALPHA }, '/');
    expect(rows()).toHaveLength(1);
    expect(logged()).toEqual([
      { id: ALPHA, at: NOW, path: '/city/cincinnati/transit', referrer: 'www.google.com', fromPath: null, browser: 'Chrome', os: 'macOS', device: 'desktop' },
      { id: ALPHA, at: NOW + 60_000, path: '/', referrer: '', fromPath: null, browser: 'Chrome', os: 'macOS', device: 'desktop' },
    ]);
  });

  it('logs a quick reload or a double report once', async () => {
    await view({ id: BETA }, '/map/earthquakes');
    vi.setSystemTime(NOW + 5_000);
    await view({ id: BETA }, '/map/earthquakes');
    vi.setSystemTime(NOW + 60_000);
    await view({ id: BETA }, '/map/earthquakes');
    expect(logged().map(r => (r as { at: number }).at)).toEqual([NOW, NOW + 60_000]);
  });

  const mapMinute = (visitor: object, path: string) => t.app.request('/api/v1/page-view', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': CHROME },
    body: JSON.stringify({ visitor, path, use: 'map' }),
  }, from('203.0.113.5'));
  const minutes = () => t.db.prepare('SELECT visitor_id AS id, path, minutes FROM page_map_minute ORDER BY path').all();

  it('books a minute on a page’s small map at most once a minute, and only for a public page', async () => {
    expect((await mapMinute({ id: ALPHA }, '/map/earthquakes')).status).toBe(204);
    vi.setSystemTime(NOW + 20_000);
    await mapMinute({ id: ALPHA }, '/map/earthquakes');
    vi.setSystemTime(NOW + 60_000);
    await mapMinute({ id: ALPHA }, '/map/earthquakes');
    await mapMinute({ id: ALPHA }, '/');
    await mapMinute({ id: ALPHA }, '/admin');
    expect(minutes()).toEqual([{ id: ALPHA, path: '/map/earthquakes', minutes: 2 }]);
    expect(rows()).toEqual([]);
    expect(logged()).toEqual([]);
    expect(t.db.prepare('SELECT count(*) FROM map_time').pluck().get()).toBe(0);
  });
});

describe('logging a view', () => {
  it('keeps the town the address is in, not the address', () => {
    const db = openAppDb(':memory:');
    migrateAppSchema(db);
    const presence = createPresence(() => NOW);
    const locate = (ip: string) => (ip === '203.0.113.5' ? { country: 'DE', region: 'Hesse', city: 'Frankfurt am Main', latitude: 50.1, longitude: 8.7 } : null);
    const reads = createPageReads(db, { now: () => NOW, locate, presence });
    const read = parsePageRead({ visitor: { id: ALPHA, referrer: 'duckduckgo.com' }, path: '/about', locale: 'de' }, CHROME)!;
    reads.record(read, { ip: '203.0.113.5', country: null, userId: null });
    reads.record({ ...read, visitorId: BETA }, { ip: '198.51.100.9', country: 'FR', userId: null });
    expect(db.prepare('SELECT visitor_id AS id, country, region, city FROM page_view ORDER BY view_id').all()).toEqual([
      { id: ALPHA, country: 'DE', region: 'Hesse', city: 'Frankfurt am Main' },
      { id: BETA, country: 'FR', region: null, city: null },
    ]);
    expect(JSON.stringify(db.prepare('SELECT * FROM page_view').all())).not.toContain('203.0.113.5');
    expect(presence.list().map(p => ({ key: p.key, kind: p.kind, path: p.path, referrer: p.referrer, city: p.place?.city ?? null }))).toEqual([
      { key: ALPHA, kind: 'page', path: '/about', referrer: 'duckduckgo.com', city: 'Frankfurt am Main' },
      { key: BETA, kind: 'page', path: '/about', referrer: 'duckduckgo.com', city: null },
    ]);
    db.close();
  });

  it('keeps a reader using the page’s small map on Live past the view’s five minutes', () => {
    const db = openAppDb(':memory:');
    migrateAppSchema(db);
    let at = NOW;
    const presence = createPresence(() => at);
    const reads = createPageReads(db, { now: () => at, presence });
    const read = parsePageRead({ visitor: { id: ALPHA, referrer: 'duckduckgo.com' }, path: '/city/berlin', locale: 'de' }, CHROME)!;
    const context = { ip: '203.0.113.5', country: 'DE', userId: null };
    reads.record(read, context);
    for (const minute of [4, 8]) {
      at = NOW + minute * 60_000;
      reads.recordMapMinute(parseMapMinute({ visitor: { id: ALPHA }, path: '/city/berlin', use: 'map' }, CHROME)!, context);
    }
    at = NOW + 12 * 60_000;
    expect(presence.list().map(p => ({ path: p.path, features: p.features, referrer: p.referrer, since: p.since, browser: p.agent?.browser }))).toEqual([
      { path: '/city/berlin', features: [SMALL_MAP_FEATURE], referrer: 'duckduckgo.com', since: NOW, browser: 'Chrome' },
    ]);
    db.close();
  });
});

describe('the pages in admin', () => {
  let t: TestApp;
  let kit: ReturnType<typeof adminKit>;
  let root: { jar: Jar; id: string };
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    t = await startApp();
    kit = adminKit(t);
    root = await kit.admin();
    const read = t.db.prepare('INSERT INTO page_read (visitor_id, day, path, locale, referrer, views) VALUES (?, ?, ?, ?, ?, ?)');
    // Alpha came from Google to Cincinnati's transit in Turkish and opened the map; Beta read two pages; Gamma is the admin.
    read.run(ALPHA, TODAY - 2, '/city/cincinnati/transit', 'tr', 'www.google.com', 3);
    read.run(BETA, TODAY - 1, '/city/cincinnati/transit', 'en', '', 1);
    read.run(BETA, TODAY, '/guides/what-gps-jamming-looks-like', 'en', 'news.ycombinator.com', 2);
    read.run(GAMMA, TODAY, '/map/earthquakes', 'en', '', 4);
    read.run(BETA, TODAY - 200, '/about', 'en', '', 1);
    t.db.prepare('INSERT INTO visitor (visitor_id, first_seen_at, last_seen_at, user_id, linked_at) VALUES (?, ?, ?, ?, ?)')
      .run(GAMMA, NOW, NOW, root.id, NOW);
    t.db.prepare('INSERT INTO visitor_day (visitor_id, day, minutes, last_tick_at) VALUES (?, ?, ?, 0)').run(ALPHA, TODAY - 2, 4);
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

  it('counts views, readers, who went on to the map, and who sent them', async () => {
    const p = await get<Record<string, unknown> & { daily: unknown[] }>('/pages');
    expect(p).toMatchObject({ today: isoDay(TODAY), since: isoDay(TODAY - 200) });
    expect(p.totals).toEqual({ views: 10, readers: 3, pages: 3, toMap: 1 });
    expect(p.daily).toHaveLength(30);
    expect(p.daily.at(-1)).toEqual({ day: isoDay(TODAY), views: 6, readers: 2 });
    expect(p.pages).toEqual([
      { path: '/city/cincinnati/transit', views: 4, readers: 2, toMap: 1 },
      { path: '/map/earthquakes', views: 4, readers: 1, toMap: 0 },
      { path: '/guides/what-gps-jamming-looks-like', views: 2, readers: 1, toMap: 0 },
    ]);
    expect(p.sections).toEqual([{ section: '/city', views: 4, readers: 2 }, { section: '/map', views: 4, readers: 1 }, { section: '/guides', views: 2, readers: 1 }]);
    expect(p.referrers).toEqual([
      { referrer: null, views: 5, readers: 2 },
      { referrer: 'www.google.com', views: 3, readers: 1 },
      { referrer: 'news.ycombinator.com', views: 2, readers: 1 },
    ]);
    expect(p.locales).toEqual([{ locale: 'en', views: 7 }, { locale: 'tr', views: 3 }]);
  });

  it('leaves out an admin’s reading when asked', async () => {
    const p = await get<{ totals: { views: number; readers: number } }>('/pages?admins=exclude');
    expect(p.totals).toMatchObject({ views: 6, readers: 2 });
  });

  it('is behind the gate', async () => {
    const user = await t.signUpVerified(new Jar(), { name: 'Cy', email: 'cy@example.invalid', password: 'another horse battery' });
    await kit.expectGated('GET', '/api/admin/analytics/pages', user);
  });
});
