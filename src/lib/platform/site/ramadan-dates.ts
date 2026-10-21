import { addDays } from './places/topics/prayer-hijri';
import { eidAlAdhaOf, ramadanOf, ramadansBeginning, type RamadanSpan } from './places/topics/ramadan-calendar';

/**
 * The /ramadan page's facts, from the Umm al-Qura calendar on the day it is read: the Ramadan under way or next and
 * the one after, this and next Gregorian year's, and every one from ten years back to ten ahead.
 */

export interface RamadanFacts extends RamadanSpan {
  /** The Gregorian year it begins in. */
  year: number;
  /** The second Ramadan to begin in that year (2030), named with its Hijri year too. */
  twin: boolean;
  /** The evening before the first fast. */
  tarawih: string;
  /** The 26th, whose evening begins the night before the 27th. */
  qadr: string;
  eidAlAdha: string;
}

export interface RamadanDates {
  today: string;
  thisYear: number;
  /** Under way (today on or before its last day) or next. */
  nearest: RamadanFacts;
  /** Which day of it today is, while it is under way. */
  day: number | null;
  following: RamadanFacts;
  /** Ramadans beginning this Gregorian year and next. */
  thisYears: RamadanFacts[];
  nextYears: RamadanFacts[];
  /** From `thisYear - SPAN` to `thisYear + SPAN`. */
  rows: RamadanFacts[];
}

export const SPAN = 10;

const yearOf = (date: string) => Number(date.slice(0, 4));

export function ramadanFacts(hijriYear: number): RamadanFacts {
  const span = ramadanOf(hijriYear);
  const year = yearOf(span.start);
  return {
    ...span, year,
    twin: yearOf(ramadanOf(hijriYear - 1).start) === year,
    tarawih: addDays(span.start, -1),
    qadr: addDays(span.start, 25),
    eidAlAdha: eidAlAdhaOf(hijriYear),
  };
}

/** `today` is a UTC calendar day, YYYY-MM-DD. */
export function ramadanDates(today = new Date().toISOString().slice(0, 10)): RamadanDates {
  const thisYear = yearOf(today);
  const rows = ramadansBeginning(thisYear - SPAN, thisYear + SPAN).map(ramadanFacts);
  const at = rows.findIndex(r => today <= r.end);
  const nearest = rows[at];
  const day = today >= nearest.start ? Math.round((Date.parse(today) - Date.parse(nearest.start)) / 86_400_000) + 1 : null;
  return {
    today, thisYear, nearest, day,
    following: rows[at + 1] ?? ramadanFacts(nearest.hijriYear + 1),
    thisYears: rows.filter(r => r.year === thisYear),
    nextYears: rows.filter(r => r.year === thisYear + 1),
    rows,
  };
}
