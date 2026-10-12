import { Prec } from '@takip/core/time';

/** Epoch ms for a UTC calendar date; works for years before 100 and BCE (year 0 = 1 BCE). */
export function utc(year: number, month = 1, day = 1) {
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  return d.getTime();
}

export type Stated = { t: number; prec: Prec };

/**
 * A date from year/month/day parts, any of which may be a sentinel (0, -8, -9, blank).
 * A missing month or day lowers the precision instead of inventing a date.
 */
export function ymd(year: number | null, month: number | null = null, day: number | null = null): Stated | null {
  if (year === null || !Number.isInteger(year)) return null;
  if (month === null || month < 1 || month > 12) return { t: utc(year), prec: Prec.year };
  if (day === null || day < 1 || day > 31) return { t: utc(year, month), prec: Prec.month };
  return { t: utc(year, month, day), prec: Prec.day };
}

/** 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD'; anything else is null. */
export function isoDate(s: string | null | undefined): Stated | null {
  const m = s?.trim().match(/^(-?\d{1,4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (!m) return null;
  return ymd(Number(m[1]), m[2] ? Number(m[2]) : null, m[3] ? Number(m[3]) : null);
}

/** The year of an epoch-ms time. */
export const yearOf = (t: number) => new Date(t).getUTCFullYear();
