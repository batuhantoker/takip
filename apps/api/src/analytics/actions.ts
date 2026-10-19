import type { AppDb } from '../db/app-db';
import { eachDay, type Range } from './range';

/* Named actions per day and subject (action_count, written by access/map-time.ts); names only, never what was typed. */

const CHARTED = 8;

// Daily visitor hashes can't be tied to an account, so they always count.
const actionNotAdmin = (r: Range) =>
  r.excludeAdmins
    ? `AND NOT (subject_type = 'user' AND subject_id IN (SELECT id FROM auth_user WHERE role = 'admin'))
       AND NOT (subject_type = 'visitor' AND subject_id IN (SELECT visitor_id FROM visitor WHERE user_id IN (SELECT id FROM auth_user WHERE role = 'admin')))`
    : '';

/** Every action in the range with how many accounts and visitors took it, and per-day counts of the busiest. */
export function actionUse(db: AppDb, r: Range) {
  // A visitor id is one visitor across days; a daily hash is one visitor-day, as elsewhere.
  const actions = db.prepare(`
    SELECT action, sum(count) AS count,
           count(DISTINCT CASE WHEN subject_type = 'user' THEN subject_id END) AS users,
           count(DISTINCT CASE WHEN subject_type = 'visitor' THEN subject_id WHEN subject_type = 'anon' THEN day || ':' || subject_id END) AS visitors
    FROM action_count WHERE day >= ? ${actionNotAdmin(r)} GROUP BY action ORDER BY count DESC, action`)
    .all(r.first) as { action: string; count: number; users: number; visitors: number }[];

  const charted = actions.slice(0, CHARTED).map(a => a.action);
  const actionDays = eachDay(r, day => ({ day, counts: Object.fromEntries(charted.map(a => [a, 0])) as Record<string, number> }));
  if (charted.length) {
    for (const row of db.prepare(`
      SELECT day, action, sum(count) AS count FROM action_count
      WHERE day >= ? AND action IN (SELECT value FROM json_each(?)) ${actionNotAdmin(r)} GROUP BY day, action`)
      .all(r.first, JSON.stringify(charted)) as { day: number; action: string; count: number }[]) {
      const entry = actionDays[row.day - r.first];
      if (entry) entry.counts[row.action] = row.count;
    }
  }
  return { actions, actionDays };
}

/** One account's or visitor's actions in the range, with on how many days. */
export function subjectActions(db: AppDb, type: 'user' | 'visitor', id: string, r: Range) {
  return db.prepare(`
    SELECT action, sum(count) AS count, count(DISTINCT day) AS days FROM action_count
    WHERE subject_type = ? AND subject_id = ? AND day >= ? GROUP BY action ORDER BY count DESC, action`)
    .all(type, id, r.first) as { action: string; count: number; days: number }[];
}
