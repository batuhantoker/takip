import type { AppDb } from '../db/app-db';
import { median, personOf } from './engagement-people';
import type { Range } from './range';

/* Named actions per day and subject (action_count, written by access/map-time.ts); names only, never what was typed. */

const ADMINS = "(SELECT id FROM auth_user WHERE role = 'admin')";

/**
 * Every action in the range taken by an account or a browser with a visitor id (the daily address hashes of browsers that
 * keep none can't be told apart), with its uses, who took it and the median uses per person. A browser signed in to an
 * account counts as that account, as in engagement-people.ts.
 */
export function actionReach(db: AppDb, r: Range) {
  const rows = db.prepare(`
    SELECT a.subject_type AS type, a.subject_id AS id, v.user_id AS userId, a.action, sum(a.count) AS count
    FROM action_count a LEFT JOIN visitor v ON a.subject_type = 'visitor' AND v.visitor_id = a.subject_id
    WHERE a.day >= ? AND a.subject_type IN ('user', 'visitor')
      ${r.excludeAdmins ? `AND NOT (a.subject_type = 'user' AND a.subject_id IN ${ADMINS}) AND (v.user_id IS NULL OR v.user_id NOT IN ${ADMINS})` : ''}
    GROUP BY a.subject_type, a.subject_id, a.action`).all(r.first) as { type: 'user' | 'visitor'; id: string; userId: string | null; action: string; count: number }[];

  const by = new Map<string, { count: number; users: Set<string>; visitors: Set<string>; people: Map<string, number> }>();
  for (const row of rows) {
    const a = by.get(row.action) ?? by.set(row.action, { count: 0, users: new Set(), visitors: new Set(), people: new Map() }).get(row.action)!;
    const person = personOf(row.type === 'user' ? 'u' : 'v', row.id, row.userId);
    a.count += row.count;
    (row.type === 'user' ? a.users : a.visitors).add(row.id);
    a.people.set(person, (a.people.get(person) ?? 0) + row.count);
  }
  return [...by].map(([action, a]) => ({
    action, count: a.count, users: a.users.size, visitors: a.visitors.size, people: a.people.size, medianUses: median([...a.people.values()]),
  })).sort((a, b) => b.people - a.people || b.count - a.count || a.action.localeCompare(b.action));
}

/** One account's or visitor's actions in the range, with on how many days. */
export function subjectActions(db: AppDb, type: 'user' | 'visitor', id: string, r: Range) {
  return db.prepare(`
    SELECT action, sum(count) AS count, count(DISTINCT day) AS days FROM action_count
    WHERE subject_type = ? AND subject_id = ? AND day >= ? GROUP BY action ORDER BY count DESC, action`)
    .all(type, id, r.first) as { action: string; count: number; days: number }[];
}
