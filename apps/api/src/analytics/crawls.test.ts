import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAY_MS, isoDay } from '../access/usage';
import { adminKit } from '../admin/testing';
import { Jar, startApp, type TestApp } from '../testing/helpers';
import { sectionOf } from './crawls';

const NOW = Date.UTC(2026, 9, 14, 12);
const TODAY = Math.floor(NOW / DAY_MS);
const local = { incoming: { socket: { remoteAddress: '127.0.0.1' } } };

describe('crawler requests', () => {
  let t: TestApp;
  let kit: ReturnType<typeof adminKit>;
  let root: { jar: Jar; id: string };
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    t = await startApp();
    kit = adminKit(t);
    root = await kit.admin();
  });
  afterEach(() => {
    vi.useRealTimers();
    t.close();
  });

  const hand = (hits: object[], env: object = local) => t.app.request('/internal/crawl', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ hits }),
  }, env);

  it('files a page under its section, whatever its language', () => {
    expect(['/tr/city/berlin/weather', '/city/berlin', '/robots.txt', '/', '/tr', '/guides'].map(sectionOf)).toEqual(['/city', '/city', '/robots.txt', '/', '/', '/guides']);
  });

  it('takes batches from this machine only', async () => {
    expect((await hand([{ at: NOW, bot: 'Googlebot', path: '/city/berlin' }], { incoming: { socket: { remoteAddress: '203.0.113.5' } } })).status).toBe(403);
    expect((await hand([{ at: NOW, bot: 'Googlebot', path: 'no-slash' }])).status).toBe(400);
    expect(t.db.prepare('SELECT count(*) FROM crawl_hit').pluck().get()).toBe(0);
  });

  it('counts by crawler, section and page, and shows them in admin', async () => {
    expect((await hand([
      { at: NOW - DAY_MS, bot: 'Googlebot', path: '/city/berlin' },
      { at: NOW, bot: 'Googlebot', path: '/city/berlin' },
      { at: NOW, bot: 'Googlebot', path: '/tr/city/paris' },
      { at: NOW + 1000, bot: 'GPTBot (OpenAI)', path: '/robots.txt' },
    ])).status).toBe(204);

    type Crawlers = {
      totals: { hits: number; bots: number; pages: number };
      daily: { day: string; kinds: Record<string, number> }[];
      bots: { bot: string; kind: string; hits: number; days: number }[];
      sections: { section: string; hits: number }[];
      paths: { path: string; hits: number }[];
      recent: { bot: string; path: string; kind: string }[];
    };
    const res = await kit.call(root.jar, 'GET', '/api/admin/analytics/crawlers?days=7');
    expect(res.status).toBe(200);
    const c = await kit.json<Crawlers>(res);
    expect(c.totals).toEqual({ hits: 4, bots: 2, pages: 3 });
    expect(c.daily.at(-1)).toMatchObject({ day: isoDay(TODAY), kinds: { search: 2, ai: 1 } });
    expect(c.bots).toMatchObject([{ bot: 'Googlebot', kind: 'search', hits: 3, days: 2 }, { bot: 'GPTBot (OpenAI)', kind: 'ai', hits: 1, days: 1 }]);
    expect(c.sections).toMatchObject([{ section: '/city', hits: 3 }, { section: '/robots.txt', hits: 1 }]);
    expect(c.paths[0]).toMatchObject({ path: '/city/berlin', hits: 2 });
    expect(c.recent[0]).toMatchObject({ bot: 'GPTBot (OpenAI)', path: '/robots.txt', kind: 'ai' });

    const one = await kit.json<Crawlers>(await kit.call(root.jar, 'GET', '/api/admin/analytics/crawlers?days=7&bot=GPTBot%20(OpenAI)'));
    expect(one.totals.hits).toBe(1);
    expect(one.paths.map(p => p.path)).toEqual(['/robots.txt']);
    expect(one.recent.map(r => r.bot)).toEqual(['GPTBot (OpenAI)']);
  });

  it('shows on Live the crawlers here in the last five minutes, each stay with its requests and latest page', async () => {
    await hand([
      { at: NOW - 10 * 60_000, bot: 'Googlebot', path: '/city/rome' },
      { at: NOW - 2 * 60_000, bot: 'Googlebot', path: '/city/berlin' },
      { at: NOW - 60_000, bot: 'Googlebot', path: '/tr/city/paris' },
      { at: NOW - 30_000, bot: 'GPTBot (OpenAI)', path: '/robots.txt' },
      { at: NOW - 6 * 60_000, bot: 'bingbot', path: '/about' },
    ]);
    type Live = { crawlers: { bot: string; kind: string; since: number; at: number; hits: number; path: string }[] };
    const { crawlers } = await kit.json<Live>(await kit.call(root.jar, 'GET', '/api/admin/analytics/live'));
    expect(crawlers).toEqual([
      { bot: 'GPTBot (OpenAI)', kind: 'ai', since: NOW - 30_000, at: NOW - 30_000, hits: 1, path: '/robots.txt' },
      { bot: 'Googlebot', kind: 'search', since: NOW - 2 * 60_000, at: NOW - 60_000, hits: 2, path: '/tr/city/paris' },
    ]);
  });

  it('is behind the gate', async () => {
    const user = await t.signUpVerified(new Jar(), { name: 'Cy', email: 'cy@example.invalid', password: 'another horse battery' });
    await kit.expectGated('GET', '/api/admin/analytics/crawlers', user);
  });
});
