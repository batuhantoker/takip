import { z } from 'zod';
import type { AppDb } from '../db/app-db';
import { rangeQuery, type Range } from './range';

/* Visitors are browsers that keep a random id and send it with the map's minute tick (access/map-time.ts). */

/** Selects a VisitorProfile's columns from `visitor v LEFT JOIN auth_user u ON u.id = v.user_id`. */
export const PROFILE_COLUMNS = `
  v.visitor_id AS visitorId, v.first_seen_at AS firstSeenAt, v.last_seen_at AS lastSeenAt, v.user_agent AS userAgent,
  v.referrer, v.landing, v.linked_at AS linkedAt, u.id AS userId, u.email AS userEmail, u.name AS userName`;

export type ProfileRow = {
  visitorId: string; firstSeenAt: number; lastSeenAt: number; userAgent: string | null; referrer: string | null; landing: string | null;
  linkedAt: number | null; userId: string | null; userEmail: string | null; userName: string | null;
};

export const toProfile = ({ userId, userEmail, userName, ...rest }: ProfileRow) => ({
  ...rest,
  user: userId && userEmail ? { id: userId, email: userEmail, name: userName ?? '' } : null,
});

/** `v` is not linked to an admin's account; empty when admins are counted. */
export const visitorNotAdmin = (r: Range, alias = 'v') =>
  r.excludeAdmins ? `AND (${alias}.user_id IS NULL OR ${alias}.user_id NOT IN (SELECT id FROM auth_user WHERE role = 'admin'))` : '';

export const VISITOR_SORTS = ['lastSeen', 'firstSeen', 'minutes', 'activeDays'] as const;
export type VisitorSort = (typeof VISITOR_SORTS)[number];

export const visitorsQuery = z.object({
  q: z.string().trim().max(200).default(''),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  days: rangeQuery.shape.days,
  admins: rangeQuery.shape.admins,
  sort: z.enum(VISITOR_SORTS).default('lastSeen'),
});

// Literal clauses keyed by the parsed enum: the query string never reaches the SQL.
const ORDER: Record<VisitorSort, string> = {
  lastSeen: 'v.last_seen_at DESC, v.visitor_id',
  firstSeen: 'v.first_seen_at DESC, v.visitor_id',
  minutes: 'minutes DESC, activeDays DESC, v.last_seen_at DESC, v.visitor_id',
  activeDays: 'activeDays DESC, minutes DESC, v.last_seen_at DESC, v.visitor_id',
};

/** Every kept visitor with its signed-out time over the range (GET /api/admin/analytics/visitors/list), sorted and paged in SQL. */
export function visitorList(db: AppDb, query: z.infer<typeof visitorsQuery>, r: Range) {
  const like = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`;
  const params = { first: r.first, q: query.q, like, limit: query.limit, offset: query.offset };
  // Ids and emails hold '_', a LIKE wildcard: the id is matched by prefix, the email with wildcards escaped.
  const where = `WHERE (@q = '' OR substr(v.visitor_id, 1, length(@q)) = @q OR u.email LIKE @like ESCAPE '\\') ${visitorNotAdmin(r)}`;
  const from = 'FROM visitor v LEFT JOIN auth_user u ON u.id = v.user_id';
  const total = db.prepare(`SELECT count(*) ${from} ${where}`).pluck().get(params) as number;
  const rows = db.prepare(`
    SELECT ${PROFILE_COLUMNS}, coalesce(d.minutes, 0) AS minutes, coalesce(d.activeDays, 0) AS activeDays
    ${from}
    LEFT JOIN (SELECT visitor_id, sum(minutes) AS minutes, count(*) AS activeDays FROM visitor_day
               WHERE day >= @first AND minutes > 0 GROUP BY visitor_id) d ON d.visitor_id = v.visitor_id
    ${where}
    ORDER BY ${ORDER[query.sort]} LIMIT @limit OFFSET @offset`).all(params) as (ProfileRow & { minutes: number; activeDays: number })[];

  const ids = JSON.stringify(rows.map(row => row.visitorId));
  const top = new Map<string, { panel: string | null; layer: string | null; wall: boolean }>();
  for (const row of db.prepare(`
    SELECT visitor_id AS id, feature FROM visitor_feature
    WHERE day >= ? AND visitor_id IN (SELECT value FROM json_each(?))
      AND ((feature LIKE 'panel:%' AND feature != 'panel:none') OR feature LIKE 'layer:%' OR feature = 'view:wall')
    GROUP BY visitor_id, feature ORDER BY sum(minutes) DESC, feature`).all(r.first, ids) as { id: string; feature: string }[]) {
    const entry = top.get(row.id) ?? { panel: null, layer: null, wall: false };
    if (row.feature === 'view:wall') entry.wall = true;
    else if (row.feature.startsWith('panel:')) entry.panel ??= row.feature;
    else entry.layer ??= row.feature;
    top.set(row.id, entry);
  }

  return {
    total,
    days: r.days,
    sort: query.sort,
    visitors: rows.map(({ minutes, activeDays, ...row }) => ({
      ...toProfile(row),
      minutes,
      activeDays,
      topPanel: top.get(row.visitorId)?.panel ?? null,
      topLayer: top.get(row.visitorId)?.layer ?? null,
      hitWall: top.get(row.visitorId)?.wall ?? false,
    })),
  };
}
