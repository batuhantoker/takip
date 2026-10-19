import { DAY_MS, isoDay } from '../access/usage';
import type { AppDb } from '../db/app-db';
import { dayStartMs, eachDay, round1, type Range } from './range';
import { PROFILE_COLUMNS, toProfile, type ProfileRow } from './visitor-list';

const SIGN_INS = 200;
const REPORTS = 100;

/** Everything one account did (GET /api/admin/analytics/users/:id), or null when there's no such account. */
export function userAnalytics(db: AppDb, userId: string, r: Range) {
  if (!db.prepare('SELECT 1 FROM auth_user WHERE id = ?').get(userId)) return null;
  const all = <T>(sql: string, ...params: unknown[]) => db.prepare(sql).all(...params) as T[];
  const get = <T>(sql: string, ...params: unknown[]) => db.prepare(sql).get(...params) as T;
  const from = dayStartMs(r.first);

  const daily = eachDay(r, day => ({ day, minutes: 0, views: {} as Record<string, number>, apiRequests: 0, apiDenied: 0, signIns: 0 }));
  const at = (day: number) => daily[day - r.first];
  for (const row of all<{ day: number; minutes: number }>(`
    SELECT day, minutes FROM map_time WHERE subject_type = 'user' AND subject_id = ? AND day >= ? AND minutes > 0`, userId, r.first)) {
    const entry = at(row.day);
    if (entry) entry.minutes = row.minutes;
  }
  for (const row of all<{ day: number; feature: string; minutes: number }>(`
    SELECT day, feature, minutes FROM feature_time
    WHERE subject_type = 'user' AND subject_id = ? AND day >= ? AND feature LIKE 'view:%' AND minutes > 0`, userId, r.first)) {
    const entry = at(row.day);
    if (entry) entry.views[row.feature] = row.minutes;
  }
  for (const row of all<{ day: number; requests: number; denied: number }>(`
    SELECT day, sum(requests) AS requests, sum(denied) AS denied FROM usage_counter
    WHERE subject_type = 'user' AND subject_id = ? AND day >= ? GROUP BY day`, userId, r.first)) {
    const entry = at(row.day);
    if (entry) [entry.apiRequests, entry.apiDenied] = [row.requests, row.denied];
  }
  // Sign-ins an admin made while viewing as them aren't theirs.
  for (const row of all<{ day: number; n: number }>(`
    SELECT at / ${DAY_MS} AS day, count(*) AS n FROM sign_in
    WHERE user_id = ? AND at >= ? AND impersonated_by IS NULL GROUP BY 1`, userId, from)) {
    const entry = at(row.day);
    if (entry) entry.signIns = row.n;
  }

  const sum = (key: 'minutes' | 'apiRequests' | 'apiDenied' | 'signIns') => daily.reduce((n, d) => n + d[key], 0);
  const minutes = sum('minutes');
  const activeDays = daily.filter(d => d.minutes > 0).length;
  const ever = get<{ first: number | null; last: number | null }>(`
    SELECT min(day) AS first, max(day) AS last FROM map_time WHERE subject_type = 'user' AND subject_id = ? AND minutes > 0`, userId);
  const groups = all<{ group: string; requests: number; denied: number; bytes: number }>(`
    SELECT route_group AS "group", sum(requests) AS requests, sum(denied) AS denied, sum(bytes) AS bytes FROM usage_counter
    WHERE subject_type = 'user' AND subject_id = ? AND day >= ? GROUP BY route_group ORDER BY requests DESC, denied DESC, route_group`, userId, r.first);
  const totals = {
    minutes,
    activeDays,
    avgMinutesPerActiveDay: activeDays ? round1(minutes / activeDays) : 0,
    firstActiveDay: ever.first == null ? null : isoDay(ever.first),
    lastActiveDay: ever.last == null ? null : isoDay(ever.last),
    apiRequests: sum('apiRequests'),
    apiDenied: sum('apiDenied'),
    apiBytes: groups.reduce((n, g) => n + g.bytes, 0),
    signIns: sum('signIns'),
  };

  const features = all<{ feature: string; minutes: number; days: number }>(`
    SELECT feature, sum(minutes) AS minutes, count(DISTINCT day) AS days FROM feature_time
    WHERE subject_type = 'user' AND subject_id = ? AND day >= ? AND minutes > 0 GROUP BY feature ORDER BY minutes DESC, feature`, userId, r.first);
  // Day 0 (1970-01-01) was a Thursday.
  const hours = all<{ dow: number; hour: number; minutes: number }>(`
    SELECT (day + 4) % 7 AS dow, hour, sum(minutes) AS minutes FROM user_hour
    WHERE user_id = ? AND day >= ? GROUP BY 1, 2 HAVING sum(minutes) > 0 ORDER BY 1, 2`, userId, r.first);
  const keys = all<{ keyId: string; prefix: string | null; name: string | null; requests: number; denied: number; bytes: number; lastUsedAt: number | null; revokedAt: number | null }>(`
    SELECT k.key_id AS keyId, k.prefix, k.name, coalesce(sum(c.requests), 0) AS requests, coalesce(sum(c.denied), 0) AS denied,
           coalesce(sum(c.bytes), 0) AS bytes, k.last_used_at AS lastUsedAt, k.revoked_at AS revokedAt
    FROM api_key k
    LEFT JOIN usage_counter c ON c.key_id = k.key_id AND c.subject_type = 'user' AND c.subject_id = k.user_id AND c.day >= ?
    WHERE k.user_id = ? GROUP BY k.key_id ORDER BY requests DESC, k.created_at DESC`, r.first, userId);
  const signIns = all<{ at: number; ipAddress: string | null; userAgent: string | null; impersonatedBy: string | null; impersonatorEmail: string | null }>(`
    SELECT s.at, s.ip_address AS ipAddress, s.user_agent AS userAgent, s.impersonated_by AS impersonatedBy, i.email AS impersonatorEmail
    FROM sign_in s LEFT JOIN auth_user i ON i.id = s.impersonated_by
    WHERE s.user_id = ? ORDER BY s.at DESC, s.sign_in_id DESC LIMIT ${SIGN_INS}`, userId);
  const workspaces = all<{ id: string; name: string; visibility: string; createdAt: number; updatedAt: number; deletedAt: number | null }>(`
    SELECT workspace_id AS id, name, visibility, created_at AS createdAt, updated_at AS updatedAt, deleted_at AS deletedAt
    FROM ws_workspace WHERE owner_id = ? ORDER BY deleted_at IS NOT NULL, updated_at DESC`, userId);
  const reports = all<{ id: number; createdAt: number; status: string; message: string }>(`
    SELECT report_id AS id, created_at AS createdAt, status, message FROM issue_report
    WHERE user_id = ? ORDER BY report_id DESC LIMIT ${REPORTS}`, userId);
  // The browsers they signed in on, with what those browsers did signed out, over everything kept.
  const browsers = all<ProfileRow & { minutes: number; activeDays: number }>(`
    SELECT ${PROFILE_COLUMNS}, coalesce(sum(d.minutes), 0) AS minutes, count(CASE WHEN d.minutes > 0 THEN 1 END) AS activeDays
    FROM visitor v LEFT JOIN auth_user u ON u.id = v.user_id LEFT JOIN visitor_day d ON d.visitor_id = v.visitor_id
    WHERE v.user_id = ? GROUP BY v.visitor_id ORDER BY v.last_seen_at DESC, v.visitor_id`, userId)
    .map(({ minutes, activeDays, ...row }) => ({ ...toProfile(row), minutes, activeDays }));

  return {
    today: isoDay(r.today),
    since: totals.firstActiveDay,
    days: r.days,
    totals,
    daily,
    features,
    hours,
    api: { groups, keys },
    signIns,
    workspaces,
    reports,
    browsers,
  };
}
