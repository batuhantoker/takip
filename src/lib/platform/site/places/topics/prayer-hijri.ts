/**
 * Hijri dates from ICU's Umm al-Qura calendar, the tabulated one Saudi Arabia publishes. Where a month begins with
 * the sighting of the new moon it can start a day either side, so the copy says which calendar it is.
 */

export interface HijriDate { year: number; month: number; day: number }

const DAY_MS = 86_400_000;
export const RAMADAN = 9;

const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' });

/** The Hijri date on a civil day, YYYY-MM-DD. */
export function hijriOf(date: string): HijriDate {
  const out: Record<string, number> = {};
  for (const p of parts.formatToParts(Date.parse(`${date}T12:00:00Z`))) if (p.type === 'year' || p.type === 'month' || p.type === 'day') out[p.type] = Number(p.value);
  return { year: out.year, month: out.month, day: out.day };
}

export const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

export type RamadanNote =
  | { kind: 'during'; day: number; year: number; ends: string }
  | { kind: 'soon'; starts: string; year: number };

/** Ramadan now, or its first day within `ahead` days; null otherwise. */
export function ramadanNear(date: string, ahead = 60): RamadanNote | null {
  const today = hijriOf(date);
  if (today.month === RAMADAN) {
    let last = date;
    while (hijriOf(addDays(last, 1)).month === RAMADAN) last = addDays(last, 1);
    return { kind: 'during', day: today.day, year: today.year, ends: last };
  }
  for (let i = 1; i <= ahead; i++) {
    const d = addDays(date, i);
    const h = hijriOf(d);
    if (h.month === RAMADAN) return { kind: 'soon', starts: d, year: h.year };
  }
  return null;
}
