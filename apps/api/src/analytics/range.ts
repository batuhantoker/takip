import { z } from 'zod';
import type { AppDb } from '../db/app-db';
import { DAY_MS, isoDay, utcDay } from '../access/usage';

export const rangeQuery = z.object({
  days: z.coerce.number().pipe(z.union([z.literal(7), z.literal(30), z.literal(90)])).default(30),
  /** A window of hours instead of days: the visit log keeps to it exactly, tables kept by day cover the UTC days it touches. */
  hours: z.coerce.number().pipe(z.union([z.literal(6), z.literal(24), z.literal(72)])).optional(),
  admins: z.enum(['include', 'exclude']).default('include'),
  refresh: z.literal('1').optional(),
});

/**
 * UTC days `first`…`today`, and `from`, the exact start in ms (midnight of `first` unless `hours` set it);
 * `excludeAdmins` drops accounts with the admin role wherever accounts are counted.
 */
export type Range = { today: number; first: number; days: number; from: number; hours: number | null; excludeAdmins: boolean };

const HOUR_MS = 3_600_000;

export function rangeOf(query: Pick<z.infer<typeof rangeQuery>, 'days' | 'hours' | 'admins'>, now: number): Range {
  const today = utcDay(now);
  const excludeAdmins = query.admins === 'exclude';
  if (query.hours) {
    const from = now - query.hours * HOUR_MS;
    const first = utcDay(from);
    return { today, first, days: today - first + 1, from, hours: query.hours, excludeAdmins };
  }
  const first = today - query.days + 1;
  return { today, first, days: query.days, from: first * DAY_MS, hours: null, excludeAdmins };
}

/** One entry per day of the range, oldest first. */
export const eachDay = <T>(r: Range, make: (day: string) => T) => Array.from({ length: r.days }, (_, i) => make(isoDay(r.first + i)));

export const dayStartMs = (day: number) => day * DAY_MS;

/** `col` (a user id) is not an admin's; empty when admins are counted. */
export const notAdmin = (r: Range, col: string) => (r.excludeAdmins ? `AND ${col} NOT IN (SELECT id FROM auth_user WHERE role = 'admin')` : '');

/** For subject tables (usage_counter, map_time, feature_time): anonymous rows always count. */
export const subjectNotAdmin = (r: Range) =>
  r.excludeAdmins ? "AND NOT (subject_type = 'user' AND subject_id IN (SELECT id FROM auth_user WHERE role = 'admin'))" : '';

/** `alias` (a visitor row) is not linked to an admin's account; empty when admins are counted. */
export const visitorNotAdmin = (r: Range, alias = 'v') =>
  r.excludeAdmins ? `AND (${alias}.user_id IS NULL OR ${alias}.user_id NOT IN (SELECT id FROM auth_user WHERE role = 'admin'))` : '';

/** The first day the map's minute tick recorded anything, or null before it ever has. */
export function minutesSince(db: AppDb): string | null {
  const day = db.prepare('SELECT min(day) FROM (SELECT min(day) AS day FROM map_time UNION ALL SELECT min(day) FROM feature_time)').pluck().get() as number | null;
  return day == null ? null : isoDay(day);
}

/** Better Auth's ISO date text → UTC day number. */
export const isoToDay = (iso: string) => Math.floor(Date.parse(iso) / DAY_MS);

/** Monday of the UTC week holding `day` (day 0, 1970-01-01, was a Thursday). */
export const weekStart = (day: number) => day - ((day + 3) % 7);

export const round1 = (n: number) => Math.round(n * 10) / 10;
