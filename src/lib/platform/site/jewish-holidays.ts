import { addDays } from './places/topics/prayer-hijri';

/**
 * The /jewish-holidays page's facts, from ICU's Hebrew calendar on the day it is read: each holiday's days in every
 * Gregorian year from ten back to ten ahead. A date is the holiday's first full day; it begins at sunset the evening
 * before, like every Jewish day.
 */

export type HolidayKey = 'purim' | 'passover' | 'shavuot' | 'tishaBav' | 'roshHashanah' | 'yomKippur' | 'sukkot' | 'simchatTorah' | 'hanukkah';

/** In the order they fall in a Gregorian year. */
export const HOLIDAY_KEYS: readonly HolidayKey[] = ['purim', 'passover', 'shavuot', 'tishaBav', 'roshHashanah', 'yomKippur', 'sukkot', 'simchatTorah', 'hanukkah'];

export interface Holiday {
  key: HolidayKey;
  /** The Gregorian year of its first day. */
  year: number;
  /** Its first full day, YYYY-MM-DD, as kept outside Israel. */
  first: string;
  /** The evening it begins at sunset: the day before `first`. */
  eve: string;
  /** Its last day outside Israel. */
  last: string;
  /** Where Israel differs: Passover's and Shavuot's last day, Simchat Torah's day. */
  israel?: string;
  /** Tisha B'Av put off from Shabbat to Sunday. */
  moved?: boolean;
}

export interface JewishYear {
  year: number;
  /** The Hebrew year that begins at this autumn's Rosh Hashanah. */
  hebrewYear: number;
  holidays: Record<HolidayKey, Holiday>;
}

/** What the page leads with: the High Holy Days whose Yom Kippur is still to begin, and the next Passover. */
export interface JewishLead {
  roshHashanah: Holiday;
  yomKippur: Holiday;
  /** Rosh Hashanah has begun and Yom Kippur hasn't. */
  begun: boolean;
  passover: Holiday;
}

export interface JewishDates {
  today: string;
  thisYear: number;
  lead: JewishLead;
  following: JewishLead;
  /** The holiday under way, or the next to begin. */
  next: Holiday;
  /** It is under way: today is one of its days. */
  now: boolean;
  /** From `thisYear - SPAN` to `thisYear + SPAN`. */
  rows: JewishYear[];
}

export const SPAN = 10;
const OFFSET = 3761;

const parts = new Intl.DateTimeFormat('en-u-ca-hebrew-nu-latn', { year: 'numeric', day: 'numeric', timeZone: 'UTC' });

// Only the year and day: ICU's English month names are spelling, not data.
function hebrewOf(date: string): { year: number; day: number } {
  const out: Record<string, number> = {};
  for (const p of parts.formatToParts(Date.parse(`${date}T12:00:00Z`))) if (p.type === 'year' || p.type === 'day') out[p.type] = Number(p.value);
  return { year: out.year, day: out.day };
}

const months = new Map<number, string[]>();

/** The first day of each month of Hebrew year `h`, Tishri first: 12 months, 13 in a leap year (Adar I and II). */
export function monthsOf(h: number): string[] {
  const held = months.get(h);
  if (held) return held;
  // 1 Tishri falls between 5 September and 5 October.
  let start = `${h - OFFSET}-09-01`;
  while (hebrewOf(start).year < h) start = addDays(start, 1);
  const starts = [start];
  for (;;) {
    const last = starts[starts.length - 1];
    const next = hebrewOf(addDays(last, 29)).day === 1 ? addDays(last, 29) : addDays(last, 30);
    if (hebrewOf(next).year !== h) break;
    starts.push(next);
  }
  months.set(h, starts);
  return starts;
}

const isoDay = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

function holiday(key: HolidayKey, first: string, days = 1, more: Partial<Holiday> = {}): Holiday {
  return { key, year: Number(first.slice(0, 4)), first, eve: addDays(first, -1), last: addDays(first, days - 1), ...more };
}

/** Gregorian year `year`'s holidays: spring's from the Hebrew year then running, autumn's from the one it begins. */
export function jewishYear(year: number): JewishYear {
  const spring = monthsOf(year + OFFSET - 1);
  const autumn = monthsOf(year + OFFSET);
  const nisan = spring.length - 6;
  const on = (m: string[], month: number, day: number) => addDays(m[month], day - 1);
  const av9 = on(spring, nisan + 4, 9);
  const tishaBav = isoDay(av9) === 6 ? holiday('tishaBav', addDays(av9, 1), 1, { moved: true }) : holiday('tishaBav', av9);
  return {
    year,
    hebrewYear: year + OFFSET,
    holidays: {
      purim: holiday('purim', on(spring, nisan - 1, 14)),
      passover: holiday('passover', on(spring, nisan, 15), 8, { israel: on(spring, nisan, 21) }),
      shavuot: holiday('shavuot', on(spring, nisan + 2, 6), 2, { israel: on(spring, nisan + 2, 6) }),
      tishaBav,
      roshHashanah: holiday('roshHashanah', on(autumn, 0, 1), 2),
      yomKippur: holiday('yomKippur', on(autumn, 0, 10)),
      sukkot: holiday('sukkot', on(autumn, 0, 15), 7),
      simchatTorah: holiday('simchatTorah', on(autumn, 0, 23), 1, { israel: on(autumn, 0, 22) }),
      hanukkah: holiday('hanukkah', on(autumn, 2, 25), 8),
    },
  };
}

const years = new Map<number, JewishYear>();
const yearOf = (year: number) => years.get(year) ?? years.set(year, jewishYear(year)).get(year)!;

/** `today` is a UTC calendar day, YYYY-MM-DD. */
export function jewishHolidays(today = new Date().toISOString().slice(0, 10)): JewishDates {
  const thisYear = Number(today.slice(0, 4));
  const rows = Array.from({ length: 2 * SPAN + 1 }, (_, i) => yearOf(thisYear - SPAN + i));
  const high = rows.findIndex(r => today <= r.holidays.yomKippur.eve);
  const spring = rows.findIndex(r => today <= r.holidays.passover.eve);
  const leadOf = (h: number, p: number, begun: boolean): JewishLead => ({
    roshHashanah: rows[h].holidays.roshHashanah, yomKippur: rows[h].holidays.yomKippur, begun, passover: rows[p].holidays.passover,
  });
  const next = rows.flatMap(r => HOLIDAY_KEYS.map(k => r.holidays[k])).find(h => today <= h.last)!;
  return {
    today, thisYear,
    lead: leadOf(high, spring, today > rows[high].holidays.roshHashanah.eve),
    following: leadOf(high + 1, spring + 1, false),
    next, now: today >= next.first,
    rows,
  };
}
