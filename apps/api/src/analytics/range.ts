import { z } from 'zod';
import type { AppDb } from '../db/app-db';
import { DAY_MS, isoDay, utcDay } from '../access/usage';

export const rangeQuery = z.object({
  days: z.coerce.number().pipe(z.union([z.literal(7), z.literal(30), z.literal(90)])).default(30),
  admins: z.enum(['include', 'exclude']).default('include'),
  refresh: z.literal('1').optional(),
});

/** UTC days `first`…`today`; `excludeAdmins` drops accounts with the admin role wherever accounts are counted. */
export type Range = { today: number; first: number; days: number; excludeAdmins: boolean };

export function rangeOf(query: z.infer<typeof rangeQuery>, now: number): Range {
  const today = utcDay(now);
  return { today, first: today - query.days + 1, days: query.days, excludeAdmins: query.admins === 'exclude' };
}

/** One entry per day of the range, oldest first. */
export const eachDay = <T>(r: Range, make: (day: string) => T) => Array.from({ length: r.days }, (_, i) => make(isoDay(r.first + i)));

export const dayStartMs = (day: number) => day * DAY_MS;

/** `col` (a user id) is not an admin's; empty when admins are counted. */
export const notAdmin = (r: Range, col: string) => (r.excludeAdmins ? `AND ${col} NOT IN (SELECT id FROM auth_user WHERE role = 'admin')` : '');

/** For subject tables (usage_counter, map_time, feature_time): anonymous rows always count. */
export const subjectNotAdmin = (r: Range) =>
  r.excludeAdmins ? "AND NOT (subject_type = 'user' AND subject_id IN (SELECT id FROM auth_user WHERE role = 'admin'))" : '';

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
