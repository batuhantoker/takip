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
import { rangeOf, rangeQuery, type Range } from './range';
import { cachedAsync, scanStorage, type StorageDirs } from './storage';
import { system } from './system';
import { userAnalytics } from './user-analytics';
import { visitorAnalytics } from './visitor-analytics';
import { visitorList, visitorsQuery } from './visitor-list';
import { visitors } from './visitors';

const SCAN_TTL_MS = 60_000;

/** `locate` places sign-in and last-seen addresses as they're read (geoip/ip-location.ts); without it they stay unplaced. */
export type AnalyticsOptions = { dirs?: StorageDirs; startedAt?: number; locate?: IpLocator };

/** Mounted at /api/admin/analytics behind the gate. Shapes: src/components/site/admin/analytics/analytics-types.ts. */
export function analyticsRoutes({ db, access, usage, metrics, dirs = {}, startedAt = Date.now() - process.uptime() * 1000, locate, now = () => Date.now() }: {
  db: AppDb; access: AccessResolver; usage: Usage; metrics?: Metrics; now?: () => number;
} & AnalyticsOptions) {
  const app = new Hono();
  // Walking the data directory and counting history.db take a while, so both are held for a minute; ?refresh=1 redoes them.
  const storage = cachedAsync(() => scanStorage(db, dirs, now()), SCAN_TTL_MS, now);
  const history = cachedAsync(async () => (dirs.dataDir ? historyCounts(dirs.dataDir) : []), SCAN_TTL_MS, now);

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
