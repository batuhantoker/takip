import type { AppDb } from '../db/app-db';
import { notAdmin, visitorNotAdmin, type Range } from './range';

export const HOUR_MS = 3_600_000;

/** `h` is the hour since the epoch (UTC day × 24 + hour). */
type HourRow = { h: number; minutes: number };

/**
 * Minutes on the full map (every signed-out browser's, storage-blocked ones included, and accounts') and on the public
 * pages' small maps, by hour, so a window of hours keeps to the hour it began in.
 */
export function mapMinutes(db: AppDb, r: Range) {
  const params = { first: r.first, fromHour: Math.floor(r.from / HOUR_MS) };
  const since = (alias = '') => `${alias}day >= @first AND ${alias}day * 24 + ${alias}hour >= @fromHour`;
  const full = [
    ...db.prepare(`SELECT day * 24 + hour AS h, minutes FROM activity_hour WHERE subject_type = 'anon' AND ${since()}`).all(params),
    ...db.prepare(`SELECT day * 24 + hour AS h, sum(minutes) AS minutes FROM user_hour WHERE ${since()} ${notAdmin(r, 'user_id')} GROUP BY h`).all(params),
  ] as HourRow[];
  const pages = db.prepare(`
    SELECT m.day * 24 + m.hour AS h, m.path, m.visitor_id AS visitorId, m.minutes
    FROM page_map_minute m LEFT JOIN visitor v ON v.visitor_id = m.visitor_id
    WHERE ${since('m.')} ${visitorNotAdmin(r)}`).all(params) as (HourRow & { path: string; visitorId: string })[];
  return { full, pages };
}

export type MapMinutes = ReturnType<typeof mapMinutes>;

/** Minutes and browsers per page on its small map, for the pages table. */
export function pageMapUse(pages: MapMinutes['pages']) {
  const by = new Map<string, { minutes: number; visitors: Set<string> }>();
  for (const row of pages) {
    const entry = by.get(row.path) ?? { minutes: 0, visitors: new Set() };
    entry.minutes += row.minutes;
    entry.visitors.add(row.visitorId);
    by.set(row.path, entry);
  }
  return by;
}
