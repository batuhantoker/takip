import { isoDay } from '../access/usage';
import type { AppDb } from '../db/app-db';
import { eachDay, minutesSince, notAdmin, subjectNotAdmin, type Range } from './range';

const TOP_PER_PREFIX = 8;
const TOP_USERS = 25;
const BUCKETS: [label: string, upTo: number][] = [['1', 1], ['2–5', 5], ['6–15', 15], ['16–30', 30], ['31–60', 60], ['61–120', 120], ['120+', Infinity]];

type FeatureRow = { feature: string; minutes: number; users: number; visitors: number };

/** Where the map's minutes went (GET /api/admin/analytics/engagement). */
export function engagement(db: AppDb, r: Range) {
  const all = <T>(sql: string, ...params: unknown[]) => db.prepare(sql).all(...params) as T[];

  // Visitor ids are a daily hash, so one visitor on two days is two visitor-days.
  const features = all<FeatureRow>(`
    SELECT feature, sum(minutes) AS minutes,
           count(DISTINCT CASE WHEN subject_type = 'user' THEN subject_id END) AS users,
           count(DISTINCT CASE WHEN subject_type = 'anon' THEN day || ':' || subject_id END) AS visitors
    FROM feature_time WHERE day >= ? AND minutes > 0 ${subjectNotAdmin(r)}
    GROUP BY feature ORDER BY minutes DESC, feature`, r.first);

  const charted = ['view:', 'panel:'].flatMap(prefix => features.filter(f => f.feature.startsWith(prefix)).slice(0, TOP_PER_PREFIX).map(f => f.feature));
  const featureDays = eachDay(r, day => ({ day, minutes: Object.fromEntries(charted.map(f => [f, 0])) as Record<string, number> }));
  if (charted.length) {
    for (const row of all<{ day: number; feature: string; minutes: number }>(`
      SELECT day, feature, sum(minutes) AS minutes FROM feature_time
      WHERE day >= ? AND feature IN (SELECT value FROM json_each(?)) ${subjectNotAdmin(r)} GROUP BY day, feature`, r.first, JSON.stringify(charted))) {
      const entry = featureDays[row.day - r.first];
      if (entry) entry.minutes[row.feature] = row.minutes;
    }
  }

  // activity_hour keeps no subject, so admins can't be taken out of it.
  const hours = all<{ dow: number; hour: number; minutes: number }>(`
    SELECT (day + 4) % 7 AS dow, hour, sum(minutes) AS minutes FROM activity_hour
    WHERE day >= ? GROUP BY 1, 2 HAVING sum(minutes) > 0 ORDER BY 1, 2`, r.first);

  const sessionLength = BUCKETS.map(([bucket]) => ({ bucket, users: 0, visitors: 0 }));
  for (const row of all<{ type: 'anon' | 'user'; minutes: number; n: number }>(`
    SELECT subject_type AS type, minutes, count(*) AS n FROM map_time
    WHERE day >= ? AND minutes > 0 ${subjectNotAdmin(r)} GROUP BY subject_type, minutes`, r.first)) {
    const entry = sessionLength[BUCKETS.findIndex(([, upTo]) => row.minutes <= upTo)];
    entry[row.type === 'user' ? 'users' : 'visitors'] += row.n;
  }

  const top = all<{ userId: string; email: string; name: string; minutes: number; activeDays: number; lastDay: number }>(`
    SELECT m.subject_id AS userId, u.email, u.name, sum(m.minutes) AS minutes, count(*) AS activeDays, max(m.day) AS lastDay
    FROM map_time m JOIN auth_user u ON u.id = m.subject_id
    WHERE m.subject_type = 'user' AND m.day >= ? AND m.minutes > 0 ${notAdmin(r, 'm.subject_id')}
    GROUP BY m.subject_id ORDER BY minutes DESC, u.email LIMIT ?`, r.first, TOP_USERS);
  const topFeature = new Map<string, { feature: string; minutes: number }>();
  for (const row of all<{ userId: string; feature: string; minutes: number }>(`
    SELECT subject_id AS userId, feature, sum(minutes) AS minutes FROM feature_time
    WHERE subject_type = 'user' AND day >= ? AND feature LIKE 'panel:%' AND feature != 'panel:none'
      AND subject_id IN (SELECT value FROM json_each(?))
    GROUP BY subject_id, feature ORDER BY minutes DESC, feature`, r.first, JSON.stringify(top.map(u => u.userId)))) {
    if (!topFeature.has(row.userId)) topFeature.set(row.userId, row);
  }
  const topUsers = top.map(u => ({ ...u, lastDay: isoDay(u.lastDay), topFeature: topFeature.get(u.userId)?.feature ?? null }));

  const wall = eachDay(r, day => ({ day, users: 0, visitors: 0 }));
  for (const row of all<{ day: number; type: 'anon' | 'user'; n: number }>(`
    SELECT day, subject_type AS type, count(DISTINCT subject_id) AS n FROM feature_time
    WHERE day >= ? AND feature = 'view:wall' AND minutes > 0 ${subjectNotAdmin(r)} GROUP BY day, subject_type`, r.first)) {
    const entry = wall[row.day - r.first];
    if (entry) entry[row.type === 'user' ? 'users' : 'visitors'] = row.n;
  }

  return { today: isoDay(r.today), days: r.days, since: minutesSince(db), features, featureDays, hours, sessionLength, topUsers, wall };
}
