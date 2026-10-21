import { addDays, hijriOf, RAMADAN } from './prayer-hijri';

/**
 * Which Ramadans have pages, from the Umm al-Qura calendar: every one from 1435 AH (2014) to about nine years ahead,
 * worked out when asked, so the range rolls on by itself. Only the one under way or next and the three after it are
 * for search; a page stays after its Eid, so search engines never find it gone.
 */

export interface RamadanSpan {
  hijriYear: number;
  /** The first and last days of fasting, and Eid al-Fitr (1 Shawwal), YYYY-MM-DD. */
  start: string;
  end: string;
  eid: string;
  days: number;
}

export interface RamadanYear {
  hijriYear: number;
  /** The Gregorian year it begins in, which names the page. */
  year: number;
  /** A second Ramadan beginning in the same Gregorian year (2030), told apart by its Hijri year. */
  twin: boolean;
  slug: string;
  ended: boolean;
  /** One of the Ramadans offered to search engines. */
  indexed: boolean;
  /** The one under way, or else the next: the one a place's nav lists. */
  nearest: boolean;
}

export const FIRST_RAMADAN = 1435;
/** Indexed Ramadans beyond the next one not yet begun, and the further ones with pages at all. */
const INDEXED_AHEAD = 3;
const PAGES_AHEAD = 9;
const HIJRI_YEAR_DAYS = 354.367;
// Only a starting guess for the search below: 1 Ramadan 1448 is 8 February 2027 in the Umm al-Qura calendar.
const SEED = { hijriYear: 1448, start: '2027-02-08' };

const spans = new Map<number, RamadanSpan>();

export function ramadanOf(hijriYear: number): RamadanSpan {
  const held = spans.get(hijriYear);
  if (held) return held;
  const before = (d: string) => {
    const h = hijriOf(d);
    return h.year < hijriYear || (h.year === hijriYear && h.month < RAMADAN);
  };
  let start = addDays(SEED.start, Math.round((hijriYear - SEED.hijriYear) * HIJRI_YEAR_DAYS));
  while (!before(addDays(start, -1))) start = addDays(start, -1);
  while (before(start)) start = addDays(start, 1);
  let end = start;
  while (hijriOf(addDays(end, 1)).month === RAMADAN) end = addDays(end, 1);
  const span = { hijriYear, start, end, eid: addDays(end, 1), days: Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1 };
  spans.set(hijriYear, span);
  return span;
}

const startYear = (hijriYear: number) => Number(ramadanOf(hijriYear).start.slice(0, 4));

export function ramadanYear(hijriYear: number, today: string, nearest: boolean, next: number): RamadanYear {
  const year = startYear(hijriYear);
  const twin = startYear(hijriYear - 1) === year;
  const ended = today > ramadanOf(hijriYear).eid;
  return { hijriYear, year, twin, slug: twin ? `ramadan-${year}-${hijriYear}` : `ramadan-${year}`, ended, indexed: !ended && hijriYear <= next + INDEXED_AHEAD, nearest };
}

let listed: { today: string; years: RamadanYear[] } | null = null;

/** The Ramadans with pages on `today` (UTC, YYYY-MM-DD), oldest first. */
export function ramadanYears(today = new Date().toISOString().slice(0, 10)): RamadanYear[] {
  if (listed?.today === today) return listed.years;
  let next = FIRST_RAMADAN;
  while (ramadanOf(next).start <= today) next++;
  const all = Array.from({ length: next + 1 + PAGES_AHEAD - FIRST_RAMADAN }, (_, i) => FIRST_RAMADAN + i);
  const nearest = all.find(hy => today <= ramadanOf(hy).eid);
  const years = all.map(hy => ramadanYear(hy, today, hy === nearest, next));
  listed = { today, years };
  return years;
}

export const nearestRamadan = (today?: string) => ramadanYears(today).find(y => y.nearest)!;

/** Eid al-Adha, 10 Dhu al-Hijjah of the Hijri year, YYYY-MM-DD: about ten weeks after Eid al-Fitr. */
export function eidAlAdhaOf(hijriYear: number): string {
  let d = addDays(ramadanOf(hijriYear).eid, 60);
  for (let h = hijriOf(d); h.year === hijriYear && (h.month < 12 || h.day < 10); h = hijriOf(d)) d = addDays(d, 1);
  return d;
}

/** The Hijri years of every Ramadan beginning in the Gregorian years `from` to `to`, oldest first; 2030 has two. */
export function ramadansBeginning(from: number, to: number): number[] {
  let hijriYear = hijriOf(`${from}-01-01`).year - 1;
  while (startYear(hijriYear) < from) hijriYear++;
  const out: number[] = [];
  for (; startYear(hijriYear) <= to; hijriYear++) out.push(hijriYear);
  return out;
}
