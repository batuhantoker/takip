import { CRAWLER_KINDS, crawlerKind, type CrawlerKind } from '@takip/core/crawlers';
import { Hono } from 'hono';
import { isIP } from 'node:net';
import { z } from 'zod';
import { utcDay, isoDay } from '../access/usage';
import type { AppDb } from '../db/app-db';
import { eachDay, rangeQuery, type Range } from './range';

const MAX_HITS = 5000;
const RECENT = 300;
// As with a page reader on Live: a crawler is here while its requests come less than five minutes apart.
const HERE_MS = 5 * 60_000;
const TOP = 50;
/** crawl_path's window; usage-prune.ts keeps the same. */
export const CRAWL_PATH_DAYS = 14;

const LOCALE_PREFIX = /^\/(?:tr|es|pt|fr|de|ru|ar|zh|ja)(?=\/|$)/;

/** '/tr/city/berlin' → '/city', '/robots.txt' → '/robots.txt', '/' → '/'. */
export const sectionOf = (path: string) => `/${path.replace(LOCALE_PREFIX, '').split('/')[1] ?? ''}`;

const hitSchema = z.object({
  at: z.number().int().positive(),
  bot: z.string().regex(/^[\p{L}\p{N} ._()-]{1,80}$/u),
  path: z.string().regex(/^\/[^\s?#]{0,300}$/),
});

export type CrawlHit = z.infer<typeof hitSchema>;

/** A crawler on the site now: when this stay began, its latest request and page, and its requests since. */
export type CrawlerHere = { bot: string; since: number; at: number; hits: number; path: string };

/**
 * Crawler requests, counted per day by section and by page; the latest few are also held in memory for the admin, and
 * the crawlers here now (`here`, for Live).
 */
export function createCrawlLog(db: AppDb, now = () => Date.now()) {
  const bySection = db.prepare(`
    INSERT INTO crawl_hit (day, bot, section, hits) VALUES (@day, @bot, @section, 1)
    ON CONFLICT (day, bot, section) DO UPDATE SET hits = hits + 1`);
  const byPath = db.prepare(`
    INSERT INTO crawl_path (day, bot, path, hits, last_at) VALUES (@day, @bot, @path, 1, @at)
    ON CONFLICT (day, bot, path) DO UPDATE SET hits = hits + 1, last_at = max(last_at, excluded.last_at)`);
  const latest: CrawlHit[] = [];
  const stays = new Map<string, CrawlerHere>();
  const note = (hit: CrawlHit) => {
    const kept = stays.get(hit.bot);
    const still = kept && hit.at - kept.at <= HERE_MS ? kept : null;
    stays.set(hit.bot, { bot: hit.bot, since: still?.since ?? hit.at, at: hit.at, hits: (still?.hits ?? 0) + 1, path: hit.path });
  };
  const record = db.transaction((hits: CrawlHit[]) => {
    for (const hit of hits) {
      const day = utcDay(hit.at);
      bySection.run({ day, bot: hit.bot, section: sectionOf(hit.path) });
      byPath.run({ day, bot: hit.bot, path: hit.path, at: hit.at });
    }
  });
  return {
    record(hits: CrawlHit[]) {
      // A clock far off (or a replayed batch) books to today rather than some other day.
      const at = now();
      const fixed = hits.map(h => (Math.abs(h.at - at) > 86_400_000 ? { ...h, at } : h));
      record(fixed);
      latest.unshift(...fixed.sort((a, b) => b.at - a.at));
      latest.length = Math.min(latest.length, RECENT);
      for (let i = fixed.length - 1; i >= 0; i--) note(fixed[i]);
    },
    recent: () => latest,
    /** The crawlers here now, latest first. */
    here(): (CrawlerHere & { kind: CrawlerKind })[] {
      const at = now();
      for (const [bot, stay] of stays) if (at - stay.at > HERE_MS) stays.delete(bot);
      return [...stays.values()].sort((a, b) => b.at - a.at).map(s => ({ ...s, kind: crawlerKind(s.bot) }));
    },
  };
}

export type CrawlLog = ReturnType<typeof createCrawlLog>;

type SocketBindings = { incoming?: { socket?: { remoteAddress?: string } } } | undefined;
const LOOPBACK = /^(?:127\.|::1$|::ffff:127\.)/;

/**
 * Mounted at /internal, which the web app's rewrites never reach: POST /crawl is the web app's proxy handing over the
 * crawler requests it saw ({ hits: [{ at, bot, path }] }). Only a caller on this machine is heard.
 */
export function crawlIntakeRoutes(log: CrawlLog) {
  const app = new Hono();
  app.post('/crawl', async c => {
    const peer = (c.env as SocketBindings)?.incoming?.socket?.remoteAddress ?? '';
    if (!isIP(peer) || !LOOPBACK.test(peer)) return c.json({ error: 'forbidden' }, 403);
    const parsed = z.object({ hits: z.array(hitSchema).max(MAX_HITS) }).safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
    log.record(parsed.data.hits);
    return c.body(null, 204);
  });
  return app;
}

export const crawlersQuery = rangeQuery.extend({ bot: z.string().max(80).optional() });

/** GET /api/admin/analytics/crawlers?days=&bot=: crawler requests over the range, all of them or one crawler's. */
export function crawlers(db: AppDb, log: CrawlLog, r: Range, bot?: string) {
  const params = { first: r.first, bot: bot ?? null, pathFirst: Math.max(r.first, r.today - CRAWL_PATH_DAYS + 1) };
  const one = 'AND (@bot IS NULL OR bot = @bot)';
  const all = <T>(sql: string) => db.prepare(sql).all(params) as T[];
  const since = db.prepare('SELECT min(day) FROM crawl_hit').pluck().get() as number | null;

  const daily = eachDay(r, day => ({ day, kinds: Object.fromEntries(CRAWLER_KINDS.map(k => [k, 0])) as Record<CrawlerKind, number> }));
  for (const row of all<{ day: number; bot: string; hits: number }>(`SELECT day, bot, sum(hits) AS hits FROM crawl_hit WHERE day >= @first ${one} GROUP BY day, bot`)) {
    const entry = daily[row.day - r.first];
    if (entry) entry.kinds[crawlerKind(row.bot)] += row.hits;
  }
  const bots = all<{ bot: string; hits: number; days: number; lastDay: number }>(`
    SELECT bot, sum(hits) AS hits, count(DISTINCT day) AS days, max(day) AS lastDay FROM crawl_hit WHERE day >= @first GROUP BY bot ORDER BY hits DESC, bot`)
    .map(b => ({ ...b, kind: crawlerKind(b.bot), lastDay: isoDay(b.lastDay) }));
  const sectionRows = all<{ section: string; bot: string; hits: number }>(`
    SELECT section, bot, sum(hits) AS hits FROM crawl_hit WHERE day >= @first ${one} GROUP BY section, bot ORDER BY hits DESC`);
  const sections = new Map<string, { section: string; hits: number; bots: { bot: string; hits: number }[] }>();
  for (const row of sectionRows) {
    const s = sections.get(row.section) ?? { section: row.section, hits: 0, bots: [] };
    s.hits += row.hits;
    if (s.bots.length < 3) s.bots.push({ bot: row.bot, hits: row.hits });
    sections.set(row.section, s);
  }

  return {
    since: since == null ? null : isoDay(since),
    pathDays: CRAWL_PATH_DAYS,
    totals: {
      hits: bots.filter(b => !bot || b.bot === bot).reduce((n, b) => n + b.hits, 0),
      bots: bots.length,
      pages: db.prepare(`SELECT count(DISTINCT path) FROM crawl_path WHERE day >= @pathFirst ${one}`).pluck().get(params) as number,
    },
    daily,
    bots,
    sections: [...sections.values()].sort((a, b) => b.hits - a.hits),
    paths: all<{ path: string; hits: number; bots: number; lastAt: number }>(`
      SELECT path, sum(hits) AS hits, count(DISTINCT bot) AS bots, max(last_at) AS lastAt FROM crawl_path WHERE day >= @pathFirst ${one}
      GROUP BY path ORDER BY hits DESC, path LIMIT ${TOP}`),
    recent: log.recent().filter(h => !bot || h.bot === bot).slice(0, 100).map(h => ({ ...h, kind: crawlerKind(h.bot) })),
  };
}
