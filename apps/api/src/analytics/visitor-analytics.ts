import { isoDay } from '../access/usage';
import type { AppDb } from '../db/app-db';
import { eachDay, round1, type Range } from './range';
import { PROFILE_COLUMNS, toProfile, type ProfileRow } from './visitor-list';

/** One browser's signed-out activity (GET /api/admin/analytics/visitors/:id), or null when the id isn't kept. */
export function visitorAnalytics(db: AppDb, visitorId: string, r: Range) {
  const profile = db.prepare(`SELECT ${PROFILE_COLUMNS} FROM visitor v LEFT JOIN auth_user u ON u.id = v.user_id WHERE v.visitor_id = ?`)
    .get(visitorId) as ProfileRow | undefined;
  if (!profile) return null;
  const all = <T>(sql: string, ...params: unknown[]) => db.prepare(sql).all(...params) as T[];

  const daily = eachDay(r, day => ({ day, minutes: 0, views: {} as Record<string, number> }));
  for (const row of all<{ day: number; minutes: number }>(
    'SELECT day, minutes FROM visitor_day WHERE visitor_id = ? AND day >= ? AND minutes > 0', visitorId, r.first)) {
    const entry = daily[row.day - r.first];
    if (entry) entry.minutes = row.minutes;
  }
  for (const row of all<{ day: number; feature: string; minutes: number }>(`
    SELECT day, feature, minutes FROM visitor_feature
    WHERE visitor_id = ? AND day >= ? AND feature LIKE 'view:%' AND minutes > 0`, visitorId, r.first)) {
    const entry = daily[row.day - r.first];
    if (entry) entry.views[row.feature] = row.minutes;
  }

  const minutes = daily.reduce((n, d) => n + d.minutes, 0);
  const activeDays = daily.filter(d => d.minutes > 0).length;
  const ever = db.prepare('SELECT min(day) AS first, max(day) AS last FROM visitor_day WHERE visitor_id = ? AND minutes > 0')
    .get(visitorId) as { first: number | null; last: number | null };
  const wallDays = db.prepare("SELECT count(DISTINCT day) FROM visitor_feature WHERE visitor_id = ? AND day >= ? AND feature = 'view:wall'")
    .pluck().get(visitorId, r.first) as number;
  const totals = {
    minutes,
    activeDays,
    avgMinutesPerActiveDay: activeDays ? round1(minutes / activeDays) : 0,
    firstActiveDay: ever.first == null ? null : isoDay(ever.first),
    lastActiveDay: ever.last == null ? null : isoDay(ever.last),
    wallDays,
  };

  const features = all<{ feature: string; minutes: number; days: number }>(`
    SELECT feature, sum(minutes) AS minutes, count(DISTINCT day) AS days FROM visitor_feature
    WHERE visitor_id = ? AND day >= ? AND minutes > 0 GROUP BY feature ORDER BY minutes DESC, feature`, visitorId, r.first);
  // Day 0 (1970-01-01) was a Thursday.
  const hours = all<{ dow: number; hour: number; minutes: number }>(`
    SELECT (day + 4) % 7 AS dow, hour, sum(minutes) AS minutes FROM visitor_hour
    WHERE visitor_id = ? AND day >= ? GROUP BY 1, 2 HAVING sum(minutes) > 0 ORDER BY 1, 2`, visitorId, r.first);

  return { today: isoDay(r.today), since: totals.firstActiveDay, days: r.days, visitor: toProfile(profile), totals, daily, features, hours };
}
