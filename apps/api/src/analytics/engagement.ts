import { DAY_MS, isoDay } from '../access/usage';
import type { AppDb } from '../db/app-db';
import { actionReach } from './actions';
import { arrivals, entryPoints } from './engagement-entries';
import { featureUse, mapDays, stayStats, totalsOf, weekHours } from './engagement-people';
import { eachDay, notAdmin, type Range } from './range';

const TOP_USERS = 25;

/**
 * What draws people to the map and how long they stay (GET /api/admin/analytics/engagement), counted per person: a
 * browser by its visitor id, an account, and a browser signed in to an account as that account. Minutes are minutes
 * begun, the wall's apart.
 */
export function engagement(db: AppDb, r: Range) {
  const all = <T>(sql: string, ...params: unknown[]) => db.prepare(sql).all(...params) as T[];

  const map = mapDays(db, r);
  const stay = stayStats(map.people);
  const spent = totalsOf(map.people);
  const actions = actionReach(db, r);
  const { landed, since: viewsSince } = arrivals(db, r);

  const daily = eachDay(r, day => ({ day, people: 0, minutes: 0 }));
  for (const days of map.people.values()) {
    for (const [day, minutes] of days) {
      const entry = daily[day - r.first];
      if (entry) {
        entry.people += 1;
        entry.minutes += minutes;
      }
    }
  }

  // The per-browser tables began after map_time, so the minutes counted here begin with them.
  const since = db.prepare(`SELECT min(day) FROM (SELECT min(day) AS day FROM visitor_day UNION ALL SELECT min(day) FROM map_time WHERE subject_type = 'user')`)
    .pluck().get() as number | null;
  const signedUp = db.prepare(`SELECT count(*) FROM auth_user WHERE createdAt >= ? ${notAdmin(r, 'id')}`)
    .pluck().get(new Date(r.first * DAY_MS).toISOString()) as number;

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

  return {
    today: isoDay(r.today),
    days: r.days,
    since: since == null ? null : isoDay(since),
    viewsSince: viewsSince == null ? null : isoDay(viewsSince),
    totals: {
      people: map.people.size,
      visitors: map.visitors,
      accounts: map.accounts,
      minutes: stay.minutes,
      medianMinutes: stay.medianMinutes,
      leftWithinMinute: stay.leftWithinMinute,
    },
    funnel: {
      // Everyone who opened a page or the map; the minute tables are added in case a view went unlogged.
      arrived: new Set([...landed.keys(), ...map.people.keys()]).size,
      openedMap: map.people.size,
      stayed: stay.stayed,
      cameBack: stay.cameBack,
      signUpOpened: actions.find(a => a.action === 'account.sign_up_open')?.people ?? 0,
      signedUp,
    },
    length: stay.length,
    daily,
    entries: entryPoints(landed, spent),
    features: featureUse(db, r),
    actions,
    hours: weekHours(db, r),
    topUsers,
  };
}
