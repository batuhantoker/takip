import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAY_MS, isoDay } from '../access/usage';
import { adminKit } from '../admin/testing';
import { Jar, startApp, type TestApp } from '../testing/helpers';
import { parsePageRead } from './page-reads';

const NOW = Date.UTC(2026, 9, 14, 12);
const TODAY = Math.floor(NOW / DAY_MS);
const CHROME = 'Mozilla/5.0 (Macintosh) Chrome/141.0';
const [ALPHA, BETA, GAMMA] = ['v-alpha-0000000001', 'v-beta-00000000002', 'v-gamma-0000000003'];
const from = (remoteAddress: string) => ({ incoming: { socket: { remoteAddress } } });

describe('a view report', () => {
  const body = (over: object = {}) => ({ visitor: { id: ALPHA, referrer: 'www.Google.com' }, path: '/city/cincinnati/transit', locale: 'tr', ...over });

  it('keeps the page, its language and the site that sent the reader', () => {
    expect(parsePageRead(body(), CHROME)).toEqual({ visitorId: ALPHA, path: '/city/cincinnati/transit', locale: 'tr', referrer: 'www.google.com' });
    expect(parsePageRead(body({ visitor: { id: ALPHA } }), CHROME)?.referrer).toBe('');
  });

  it('drops anything that is not a reader on a public page', () => {
    expect(parsePageRead(body(), 'Mozilla/5.0 (compatible; Googlebot/2.1)')).toBeNull();
    for (const path of ['/', '/admin', '/city/a/b/c', '/city/Cincinnati', '/docs', '/city/x?token=1']) expect(parsePageRead(body({ path }), CHROME), path).toBeNull();
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

  it('counts a page reloaded over and over 50 times a day at most', async () => {
    for (let i = 0; i < 55; i++) await view({ id: BETA }, '/map/earthquakes');
    expect(rows()).toMatchObject([{ path: '/map/earthquakes', views: 50 }]);
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
