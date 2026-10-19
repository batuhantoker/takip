import { isoDay } from '../access/usage';
import type { AppDb } from '../db/app-db';
import { eachDay, visitorNotAdmin, type Range } from './range';

const TOP = 50;

/** "/city/cincinnati/transit" → "/city". */
const SECTION = "CASE WHEN instr(substr(p.path, 2), '/') > 0 THEN substr(p.path, 1, instr(substr(p.path, 2), '/')) ELSE p.path END";

/**
 * The public pages over the range (GET /api/admin/analytics/pages): how often each was read, by how many browsers,
 * how many of those went on to open the map (a minute counted on or after the day they read it), and who sent them.
 * A reader whose browser is linked to an admin's account is left out when admins are.
 */
export function pages(db: AppDb, r: Range) {
  const params = { first: r.first };
  const all = <T>(sql: string) => db.prepare(sql).all(params) as T[];
  const from = `FROM page_read p LEFT JOIN visitor v ON v.visitor_id = p.visitor_id WHERE p.day >= @first ${visitorNotAdmin(r)}`;
  const toMap = `count(DISTINCT CASE WHEN EXISTS (SELECT 1 FROM visitor_day d WHERE d.visitor_id = p.visitor_id AND d.day >= p.day) THEN p.visitor_id END)`;
  const since = db.prepare('SELECT min(day) FROM page_read').pluck().get() as number | null;

  const totals = db.prepare(`
    SELECT coalesce(sum(p.views), 0) AS views, count(DISTINCT p.visitor_id) AS readers, count(DISTINCT p.path) AS pages, ${toMap} AS toMap
    ${from}`).get(params) as { views: number; readers: number; pages: number; toMap: number };

  const daily = eachDay(r, day => ({ day, views: 0, readers: 0 }));
  for (const row of all<{ day: number; views: number; readers: number }>(`
    SELECT p.day, sum(p.views) AS views, count(DISTINCT p.visitor_id) AS readers ${from} GROUP BY p.day`)) {
    const entry = daily[row.day - r.first];
    if (entry) Object.assign(entry, { views: row.views, readers: row.readers });
  }

  return {
    today: isoDay(r.today),
    since: since == null ? null : isoDay(since),
    totals,
    daily,
    pages: all<{ path: string; views: number; readers: number; toMap: number }>(`
      SELECT p.path, sum(p.views) AS views, count(DISTINCT p.visitor_id) AS readers, ${toMap} AS toMap
      ${from} GROUP BY p.path ORDER BY views DESC, p.path LIMIT ${TOP}`),
    sections: all<{ section: string; views: number; readers: number }>(`
      SELECT ${SECTION} AS section, sum(p.views) AS views, count(DISTINCT p.visitor_id) AS readers
      ${from} GROUP BY section ORDER BY views DESC, section`),
    referrers: all<{ referrer: string; views: number; readers: number }>(`
      SELECT p.referrer, sum(p.views) AS views, count(DISTINCT p.visitor_id) AS readers
      ${from} GROUP BY p.referrer ORDER BY views DESC, p.referrer LIMIT ${TOP}`).map(row => ({ ...row, referrer: row.referrer || null })),
    locales: all<{ locale: string; views: number }>(`
      SELECT p.locale, sum(p.views) AS views ${from} GROUP BY p.locale ORDER BY views DESC, p.locale`),
  };
}
