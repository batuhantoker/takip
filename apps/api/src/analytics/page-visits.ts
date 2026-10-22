import { z } from 'zod';
import type { AppDb } from '../db/app-db';
import { MAP_PATH } from './page-reads';
import { rangeQuery, visitorNotAdmin, type Range } from './range';
import { sourceOf, type Channel } from './sources';

/** Views further apart than this are two visits. */
const VISIT_GAP_MS = 30 * 60_000;
const MAX_STEPS = 40;

type ViewRow = {
  visitorId: string; at: number; path: string; locale: string; referrer: string; referrerPath: string | null; fromPath: string | null;
  campaign: string | null; country: string | null; region: string | null; city: string | null; latitude: number | null; longitude: number | null;
  browser: string; os: string; device: string;
  known: number; userId: string | null; email: string | null;
  /** When the browser first ticked the map, and its first view before the range, if any. */
  mapSince: number | null; priorAt: number | null;
};

/** What a visit did after the page it landed on: opened the map, read another page, or nothing more. */
export type Next = 'map' | 'page' | 'left';

export type Visit = {
  visitorId: string;
  start: number;
  end: number;
  /** The other site that sent it (host); null when typed, bookmarked or hidden. */
  origin: string | null;
  /** The linking page on that site, when it shared it. */
  originPath: string | null;
  /** The origin by name ('Google' for any of its hosts) and how it arrived (sources.ts). */
  source: string | null;
  channel: Channel;
  campaign: string | null;
  locale: string;
  place: { country: string | null; region: string | null; city: string | null; latitude: number | null; longitude: number | null } | null;
  agent: { browser: string; os: string; device: string };
  /** Pages in order ('/' for the map), a reload folded into the step before; at most MAX_STEPS. */
  steps: { path: string; at: number }[];
  views: number;
  next: Next;
  /** The browser was seen before this visit: an earlier view, or the map. */
  returning: boolean;
  /** The browser has used the map, so Admin → Visitors has a page for it. */
  known: boolean;
  user: { id: string; email: string } | null;
};

const nextOf = (steps: Visit['steps']): Next => (steps.length < 2 ? 'left' : steps[1].path === MAP_PATH ? 'map' : 'page');

/**
 * Views (one browser's, oldest first, browsers in a row) into visits: a new one begins after half an hour without a
 * view, or when another site sends the browser in afresh.
 */
export function groupVisits(rows: ViewRow[]): Visit[] {
  const visits: Visit[] = [];
  let open: Visit | null = null;
  for (const row of rows) {
    const arrived = row.referrer !== '' && row.fromPath === null && row.referrer !== open?.origin;
    if (!open || open.visitorId !== row.visitorId || row.at - open.end > VISIT_GAP_MS || arrived) {
      const again: boolean = (open as Visit | null)?.visitorId === row.visitorId;
      const { source, channel } = sourceOf(row.referrer || null);
      open = {
        visitorId: row.visitorId, start: row.at, end: row.at, origin: row.referrer || null, originPath: row.referrerPath, source, channel,
        campaign: row.campaign, locale: row.locale,
        place: row.country || row.city
          ? { country: row.country, region: row.region, city: row.city, latitude: row.latitude, longitude: row.longitude }
          : null,
        agent: { browser: row.browser, os: row.os, device: row.device },
        steps: [], views: 0, next: 'left',
        returning: again || row.priorAt != null || (row.mapSince != null && row.mapSince < row.at),
        known: !!row.known, user: row.userId && row.email ? { id: row.userId, email: row.email } : null,
      };
      visits.push(open);
    }
    open.end = row.at;
    open.views += 1;
    if (open.steps.at(-1)?.path !== row.path && open.steps.length < MAX_STEPS) open.steps.push({ path: row.path, at: row.at });
    open.next = nextOf(open.steps);
  }
  return visits;
}

/** Every visit in the range (from `r.from` exactly), oldest first; a reader whose browser is linked to an admin's account is left out when admins are. */
export function loadVisits(db: AppDb, r: Range) {
  const rows = db.prepare(`
    WITH prior AS (SELECT visitor_id, min(at) AS at FROM page_view WHERE at < @from GROUP BY visitor_id)
    SELECT p.visitor_id AS visitorId, p.at, p.path, p.locale, p.referrer, p.referrer_path AS referrerPath, p.from_path AS fromPath, p.campaign,
      p.country, p.region, p.city, p.latitude, p.longitude, p.browser, p.os, p.device,
      v.visitor_id IS NOT NULL AS known, v.first_seen_at AS mapSince, prior.at AS priorAt, u.id AS userId, u.email
    FROM page_view p LEFT JOIN visitor v ON v.visitor_id = p.visitor_id LEFT JOIN auth_user u ON u.id = v.user_id
      LEFT JOIN prior ON prior.visitor_id = p.visitor_id
    WHERE p.day >= @first AND p.at >= @from ${visitorNotAdmin(r)} ORDER BY p.visitor_id, p.at`).all({ first: r.first, from: r.from }) as ViewRow[];
  return groupVisits(rows).sort((a, b) => a.start - b.start);
}

export const visitsQuery = rangeQuery.extend({
  /** A source ('Google', a host), or 'direct' for none. */
  origin: z.string().max(200).optional(),
  page: z.string().max(200).optional(),
  country: z.string().regex(/^[A-Z]{2}$/).optional(),
  next: z.enum(['map', 'page', 'left']).optional(),
  channel: z.enum(['search', 'ai', 'social', 'site', 'direct']).optional(),
  returning: z.enum(['new', 'returning']).optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export type VisitsQuery = z.infer<typeof visitsQuery>;

export const matches = (v: Visit, q: Omit<Partial<VisitsQuery>, 'offset' | 'limit'>) =>
  (q.origin === undefined || (v.source ?? 'direct') === q.origin || v.origin === q.origin)
  && (q.page === undefined || v.steps.some(s => s.path === q.page))
  && (q.country === undefined || v.place?.country === q.country)
  && (q.next === undefined || v.next === q.next)
  && (q.channel === undefined || v.channel === q.channel)
  && (q.returning === undefined || v.returning === (q.returning === 'returning'));

/** GET /api/admin/analytics/pages/visits: the visits in the range, latest activity first, narrowed as the query says. */
export function recentVisits(visits: Visit[], q: VisitsQuery) {
  const found = visits.filter(v => matches(v, q)).sort((a, b) => b.end - a.end);
  return { total: found.length, visits: found.slice(q.offset, q.offset + q.limit) };
}
