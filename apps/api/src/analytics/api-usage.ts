import { isoDay } from '../access/usage';
import type { AppDb } from '../db/app-db';
import { dayStartMs, eachDay, notAdmin, subjectNotAdmin, type Range } from './range';

const TOP_KEYS = 10;

/** Public API traffic from usage_counter, and the keys behind it (GET /api/admin/analytics/api). Flush usage first. */
export function apiUsage(db: AppDb, r: Range, now: number) {
  const all = <T>(sql: string, ...params: unknown[]) => db.prepare(sql).all(...params) as T[];
  const count = (sql: string, ...params: unknown[]) => (db.prepare(sql).pluck().get(...params) as number | null) ?? 0;

  const days = eachDay(r, day => ({ day, requests: 0, denied: 0, bytes: 0, callers: 0, keys: 0 }));
  for (const row of all<{ day: number; requests: number; denied: number; bytes: number; callers: number; keys: number }>(`
    SELECT day, sum(requests) AS requests, sum(denied) AS denied, sum(bytes) AS bytes,
           count(DISTINCT subject_type || ':' || subject_id) AS callers,
           count(DISTINCT nullif(key_id, '')) AS keys
    FROM usage_counter WHERE day >= ? ${subjectNotAdmin(r)} GROUP BY day`, r.first)) {
    const { day, ...counts } = row;
    if (days[day - r.first]) Object.assign(days[day - r.first], counts);
  }

  const groups = all<{ group: string; requests: number; denied: number; bytes: number }>(`
    SELECT route_group AS "group", sum(requests) AS requests, sum(denied) AS denied, sum(bytes) AS bytes
    FROM usage_counter WHERE day >= ? ${subjectNotAdmin(r)}
    GROUP BY route_group ORDER BY sum(requests) + sum(denied) DESC, route_group`, r.first);

  const from = dayStartMs(r.first);
  const keyCount = (where: string, ...params: unknown[]) => count(`SELECT count(*) FROM api_key WHERE ${where} ${notAdmin(r, 'user_id')}`, ...params);
  const keys = {
    total: keyCount('1'),
    active: keyCount('revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)', now),
    revoked: keyCount('revoked_at IS NOT NULL'),
    usedInRange: count(`SELECT count(DISTINCT key_id) FROM usage_counter WHERE day >= ? AND key_id != '' AND requests > 0 ${subjectNotAdmin(r)}`, r.first),
    createdInRange: keyCount('created_at >= ?', from),
  };

  const topKeys = all<{ keyId: string; prefix: string | null; name: string | null; email: string | null; requests: number; denied: number }>(`
    SELECT c.key_id AS keyId, k.prefix, k.name, u.email, sum(c.requests) AS requests, sum(c.denied) AS denied
    FROM usage_counter c
    LEFT JOIN api_key k ON k.key_id = c.key_id
    LEFT JOIN auth_user u ON u.id = k.user_id
    WHERE c.day >= ? AND c.key_id != '' ${subjectNotAdmin(r)}
    GROUP BY c.key_id ORDER BY requests DESC, denied DESC, c.key_id LIMIT ?`, r.first, TOP_KEYS);

  const first = db.prepare('SELECT min(day) FROM usage_counter').pluck().get() as number | null;
  // The contract's range `days` (a count) gives way to the per-day rows here.
  return { today: isoDay(r.today), since: first == null ? null : isoDay(first), days, groups, keys, topKeys };
}
