import { Hono } from 'hono';
import { z } from 'zod';
import type { AccessResolver } from '../access/resolver';
import type { Usage } from '../access/usage';
import type { AppDb } from '../db/app-db';
import type { IpLocator } from '../geoip/ip-location';
import type { Metrics } from '../obs/metrics';
import { apiUsage } from './api-usage';
import { audience } from './audience';
import { dataAccumulation, historyCounts } from './data';
import { engagement } from './engagement';
import { live } from './live';
import { crawlers, crawlersQuery, createCrawlLog, type CrawlLog } from './crawls';
import { journeys, pageDetail } from './journeys';
import { loadVisits, recentVisits, visitsQuery } from './page-visits';
import { pages } from './pages';
import type { SearchConsole } from './search-console';
import { searchReport } from './search-report';
import { createPresence, type Presence } from './presence';
import { rangeOf, rangeQuery, type Range } from './range';
import { cachedAsync, scanStorage, type StorageDirs } from './storage';
import { system } from './system';
import { userAnalytics } from './user-analytics';
import { visitorAnalytics } from './visitor-analytics';
import { visitorList, visitorsQuery } from './visitor-list';
import { visitors } from './visitors';

const SCAN_TTL_MS = 60_000;
const HISTORY_TTL_MS = 10 * 60_000;
// Search Console's numbers move a few times a day, and each look costs six API calls.
const SEARCH_TTL_MS = 60 * 60_000;

/**
 * `locate` places sign-in and last-seen addresses as they're read (geoip/ip-location.ts); without it they stay unplaced.
 * `presence` is who is on the site now, as the map's tick and the page views tell it; `crawls` the crawler requests the web app hands over;
 * `searchConsole` reads Google Search, null when no key is set.
 */
export type AnalyticsOptions = { dirs?: StorageDirs; startedAt?: number; locate?: IpLocator; presence?: Presence; crawls?: CrawlLog; searchConsole?: SearchConsole | null };

/** Mounted at /api/admin/analytics behind the gate. Shapes: src/components/site/admin/analytics/analytics-types.ts. */
export function analyticsRoutes({ db, access, usage, metrics, dirs = {}, startedAt = Date.now() - process.uptime() * 1000, locate, presence = createPresence(), crawls: crawlLog, searchConsole = null, now = () => Date.now() }: {
  db: AppDb; access: AccessResolver; usage: Usage; metrics?: Metrics; now?: () => number;
} & AnalyticsOptions) {
  const app = new Hono();
  // Walking the data directory and counting history.db take a while, so both are held (the count reads all 1 GB); ?refresh=1 redoes them.
  const storage = cachedAsync(() => scanStorage(db, dirs, now()), SCAN_TTL_MS, now);
  const history = cachedAsync(async () => (dirs.dataDir ? historyCounts(dirs.dataDir) : []), HISTORY_TTL_MS, now);

  const get = (path: string, run: (r: Range, refresh: boolean) => object | Promise<object>) =>
    app.get(path, async c => {
      const parsed = rangeQuery.safeParse(c.req.query());
      if (!parsed.success) return c.json({ error: 'invalid_request', message: z.prettifyError(parsed.error) }, 400);
      return c.json(await run(rangeOf(parsed.data, now()), parsed.data.refresh === '1'));
    });

  get('/audience', r => audience(db, access, r));
  get('/engagement', r => engagement(db, r));
  get('/api', r => {
    // Counters reach the table every 10 s; flushing first includes the last few seconds.
    usage.flush();
    return apiUsage(db, r, now());
  });
  get('/storage', (_, refresh) => storage(refresh));
  get('/data', async (r, refresh) => dataAccumulation(dirs.dataDir, r, await history(refresh)));
  get('/system', r => system(db, r, { metrics, startedAt, backupDir: dirs.backupDir, now: now() }));
  get('/visitors', r => visitors(db, r));
  get('/pages', r => {
    const { visits, automated } = loadVisits(db, r);
    return { ...pages(db, r), journeys: { ...journeys(db, visits, r), automated } };
  });
  const log = crawlLog ?? createCrawlLog(db, now);
  get('/live', r => live(db, presence, log, r));
  const searches = new Map<string, (fresh?: boolean) => Promise<object>>();
  get('/search', (r, refresh) => {
    const key = `${r.days}:${r.today}`;
    if (!searches.has(key)) {
      // A new day's ranges replace yesterday's.
      if (searches.size > 6) searches.clear();
      searches.set(key, cachedAsync(() => searchReport(searchConsole, r, now()), SEARCH_TTL_MS, now));
    }
    return searches.get(key)!(refresh);
  });

  app.get('/pages/visits', c => {
    const parsed = visitsQuery.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: 'invalid_request', message: z.prettifyError(parsed.error) }, 400);
    return c.json(recentVisits(loadVisits(db, rangeOf(parsed.data, now())).visits, parsed.data));
  });

  app.get('/crawlers', c => {
    const parsed = crawlersQuery.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: 'invalid_request', message: z.prettifyError(parsed.error) }, 400);
    return c.json(crawlers(db, log, rangeOf(parsed.data, now()), parsed.data.bot));
  });

  app.get('/pages/page', c => {
    const parsed = rangeQuery.extend({ path: z.string().min(1).max(200) }).safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: 'invalid_request', message: z.prettifyError(parsed.error) }, 400);
    return c.json(pageDetail(loadVisits(db, rangeOf(parsed.data, now())).visits, parsed.data.path));
  });

  // Before /visitors/:id, which would otherwise take 'list' for an id.
  app.get('/visitors/list', c => {
    const parsed = visitorsQuery.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: 'invalid_request', message: z.prettifyError(parsed.error) }, 400);
    return c.json(visitorList(db, parsed.data, rangeOf(parsed.data, now())));
  });

  app.get('/visitors/:id', c => {
    const parsed = rangeQuery.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: 'invalid_request', message: z.prettifyError(parsed.error) }, 400);
    const result = visitorAnalytics(db, c.req.param('id'), rangeOf(parsed.data, now()));
    return result ? c.json(result) : c.json({ error: 'not_found' }, 404);
  });

  app.get('/users/:id', c => {
    const parsed = rangeQuery.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: 'invalid_request', message: z.prettifyError(parsed.error) }, 400);
    usage.flush();
    const result = userAnalytics(db, c.req.param('id'), rangeOf(parsed.data, now()), locate);
    return result ? c.json(result) : c.json({ error: 'not_found' }, 404);
  });

  return app;
}
