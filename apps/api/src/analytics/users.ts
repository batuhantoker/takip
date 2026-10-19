import { z } from 'zod';
import type { AccessResolver } from '../access/resolver';
import { isoDay } from '../access/usage';
import { toUser, USER_COLUMNS, type RawUser } from '../admin/queries';
import type { AppDb } from '../db/app-db';
import { noLocator, type IpLocator } from '../geoip/ip-location';
import { placeOfIp } from './places';
import { dayStartMs, rangeQuery, type Range } from './range';

export const USER_SORTS = ['joined', 'minutes', 'lastActive', 'api', 'signIns'] as const;
export type UserSort = (typeof USER_SORTS)[number];

export const usersQuery = z.object({
  q: z.string().trim().max(200).default(''),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  days: rangeQuery.shape.days,
  sort: z.enum(USER_SORTS).default('joined'),
});

// Literal clauses keyed by the parsed enum: the query string never reaches the SQL.
const ORDER: Record<UserSort, string> = {
  joined: 'u.createdAt DESC, u.id',
  minutes: 'minutes DESC, activeDays DESC, u.createdAt DESC, u.id',
  lastActive: 'lastActiveDay IS NULL, lastActiveDay DESC, minutes DESC, u.createdAt DESC, u.id',
  api: 'apiRequests DESC, apiDenied DESC, u.createdAt DESC, u.id',
  signIns: 'signIns DESC, u.createdAt DESC, u.id',
};

type Aggregates = { minutes: number; activeDays: number; lastActiveDay: number | null; apiRequests: number; apiDenied: number; signIns: number };

/** The Users table (GET /api/admin/users): each account with what it did over the range, sorted and paged in SQL; `locate` places lastIp. */
export function userList(db: AppDb, access: AccessResolver, query: z.infer<typeof usersQuery>, r: Range, now: number, locate: IpLocator = noLocator) {
  const params = { first: r.first, from: dayStartMs(r.first), q: query.q, like: `%${query.q}%`, limit: query.limit, offset: query.offset };
  const where = "WHERE (@q = '' OR u.email LIKE @like OR u.name LIKE @like)";
  const total = db.prepare(`SELECT count(*) FROM auth_user u ${where}`).pluck().get(params) as number;
  // Admins viewing as someone sign in on their behalf; those sessions aren't the user's.
  const rows = db.prepare(`
    SELECT ${USER_COLUMNS.split(', ').map(col => `u.${col}`).join(', ')},
           coalesce(m.minutes, 0) AS minutes, coalesce(m.activeDays, 0) AS activeDays, last.day AS lastActiveDay,
           coalesce(a.requests, 0) AS apiRequests, coalesce(a.denied, 0) AS apiDenied, coalesce(s.n, 0) AS signIns
    FROM auth_user u
    LEFT JOIN (SELECT subject_id AS id, sum(minutes) AS minutes, count(*) AS activeDays FROM map_time
               WHERE subject_type = 'user' AND day >= @first AND minutes > 0 GROUP BY subject_id) m ON m.id = u.id
    LEFT JOIN (SELECT subject_id AS id, max(day) AS day FROM map_time
               WHERE subject_type = 'user' AND minutes > 0 GROUP BY subject_id) last ON last.id = u.id
    LEFT JOIN (SELECT subject_id AS id, sum(requests) AS requests, sum(denied) AS denied FROM usage_counter
               WHERE subject_type = 'user' AND day >= @first GROUP BY subject_id) a ON a.id = u.id
    LEFT JOIN (SELECT user_id AS id, count(*) AS n FROM sign_in
               WHERE at >= @from AND impersonated_by IS NULL GROUP BY user_id) s ON s.id = u.id
    ${where}
    ORDER BY ${ORDER[query.sort]} LIMIT @limit OFFSET @offset`).all(params) as (RawUser & Aggregates)[];

  const extra = pageDetails(db, rows.map(row => row.id), r, now, locate);
  return {
    total,
    days: r.days,
    sort: query.sort,
    users: rows.map(({ minutes, activeDays, lastActiveDay, apiRequests, apiDenied, signIns, ...user }) => ({
      ...toUser(user),
      plan: access.resolve({ type: 'user', id: user.id }).plan.id,
      activity: {
        minutes,
        activeDays,
        lastActiveDay: lastActiveDay == null ? null : isoDay(lastActiveDay),
        apiRequests,
        apiDenied,
        signIns,
        ...extra(user.id),
      },
    })),
  };
}

/** What only the listed rows need: top features, when and where they were last seen, keys and workspaces. */
function pageDetails(db: AppDb, ids: string[], r: Range, now: number, locate: IpLocator) {
  const json = JSON.stringify(ids);
  const all = <T>(sql: string, ...params: unknown[]) => db.prepare(sql).all(...params) as T[];
  const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map(row => [row.id, row]));

  const top = new Map<string, { panel: string | null; layer: string | null }>();
  for (const row of all<{ id: string; feature: string }>(`
    SELECT subject_id AS id, feature FROM feature_time
    WHERE subject_type = 'user' AND day >= ? AND subject_id IN (SELECT value FROM json_each(?))
      AND ((feature LIKE 'panel:%' AND feature != 'panel:none') OR feature LIKE 'layer:%')
    GROUP BY subject_id, feature ORDER BY sum(minutes) DESC, feature`, r.first, json)) {
    const entry = top.get(row.id) ?? { panel: null, layer: null };
    if (row.feature.startsWith('panel:')) entry.panel ??= row.feature;
    else entry.layer ??= row.feature;
    top.set(row.id, entry);
  }

  const lastSignIn = byId(all<{ id: string; at: number; ua: string | null; ip: string | null }>(`
    SELECT id, at, ua, ip FROM (
      SELECT user_id AS id, at, user_agent AS ua, ip_address AS ip, row_number() OVER (PARTITION BY user_id ORDER BY at DESC, sign_in_id DESC) AS n
      FROM sign_in WHERE impersonated_by IS NULL AND user_id IN (SELECT value FROM json_each(?)))
    WHERE n = 1`, json));
  const lastSession = byId(all<{ id: string; updatedAt: string; ua: string | null; ip: string | null }>(`
    SELECT id, updatedAt, ua, ip FROM (
      SELECT userId AS id, updatedAt, userAgent AS ua, ipAddress AS ip, row_number() OVER (PARTITION BY userId ORDER BY updatedAt DESC) AS n
      FROM auth_session WHERE impersonatedBy IS NULL AND userId IN (SELECT value FROM json_each(?)))
    WHERE n = 1`, json));
  const lastTick = byId(all<{ id: string; at: number }>(`
    SELECT subject_id AS id, max(last_tick_at) AS at FROM map_time
    WHERE subject_type = 'user' AND last_tick_at > 0 AND subject_id IN (SELECT value FROM json_each(?)) GROUP BY subject_id`, json));
  const keys = byId(all<{ id: string; n: number }>(`
    SELECT user_id AS id, count(*) AS n FROM api_key
    WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?) AND user_id IN (SELECT value FROM json_each(?)) GROUP BY user_id`, now, json));
  const workspaces = byId(all<{ id: string; n: number }>(`
    SELECT owner_id AS id, count(*) AS n FROM ws_workspace
    WHERE deleted_at IS NULL AND owner_id IN (SELECT value FROM json_each(?)) GROUP BY owner_id`, json));

  return (id: string) => {
    const signIn = lastSignIn.get(id);
    const session = lastSession.get(id);
    const sessionAt = session ? Date.parse(session.updatedAt) : null;
    const seen = [signIn?.at, sessionAt, lastTick.get(id)?.at].filter((at): at is number => typeof at === 'number' && Number.isFinite(at));
    // The newer of the last sign-in and the last session in use names the device.
    const device = signIn && (sessionAt == null || signIn.at >= sessionAt) ? signIn : session;
    return {
      topPanel: top.get(id)?.panel ?? null,
      topLayer: top.get(id)?.layer ?? null,
      lastSeenAt: seen.length ? Math.max(...seen) : null,
      lastUserAgent: device?.ua ?? null,
      lastIp: device?.ip ?? null,
      lastPlace: placeOfIp(locate, device?.ip ?? null),
      keys: keys.get(id)?.n ?? 0,
      workspaces: workspaces.get(id)?.n ?? 0,
    };
  };
}
