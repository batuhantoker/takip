import { addDays } from './places/topics/prayer-hijri';

/**
 * The /easter page's facts, worked out on the day it is read: Western Easter by the Gregorian computus, Orthodox Easter
 * by the Julian one (as its Gregorian date), the feasts that hang on each, and Christmas on both calendars, from ten
 * years back to ten ahead.
 */

export interface EasterYear {
  year: number;
  ashWednesday: string;
  palmSunday: string;
  goodFriday: string;
  easter: string;
  easterMonday: string;
  ascension: string;
  pentecost: string;
  orthodoxGoodFriday: string;
  orthodoxEaster: string;
  orthodoxPentecost: string;
  /** Western and Orthodox Easter on the same day. */
  same: boolean;
  christmas: string;
  /** 25 December on the Julian calendar that falls in this Gregorian year: 7 January until 2100. */
  julianChristmas: string;
}

export interface EasterDates {
  today: string;
  thisYear: number;
  /** This year's until its Orthodox Easter has passed, then next year's. */
  nearest: EasterYear;
  following: EasterYear;
  /** From `thisYear - SPAN` to `thisYear + SPAN`. */
  rows: EasterYear[];
}

export const SPAN = 10;

const iso = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);

/** Western Easter Sunday: the anonymous Gregorian algorithm (Meeus, Jones and Butcher). */
export function westernEaster(year: number): string {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return iso(year, Math.floor(n / 31), (n % 31) + 1);
}

/** A Julian calendar date as its Gregorian one, through the Julian day number. */
export function julianToGregorian(year: number, month: number, day: number): string {
  const a = Math.floor((14 - month) / 12), y = year + 4800 - a, m = month + 12 * a - 3;
  const jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
  return new Date((jdn - 2440588) * 86_400_000).toISOString().slice(0, 10);
}

/** Orthodox Easter Sunday: Meeus's Julian algorithm, given as the Gregorian date. */
export function orthodoxEaster(year: number): string {
  const d = (19 * (year % 19) + 15) % 30;
  const e = (2 * (year % 4) + 4 * (year % 7) - d + 34) % 7;
  const n = d + e + 114;
  return julianToGregorian(year, Math.floor(n / 31), (n % 31) + 1);
}

export function easterYear(year: number): EasterYear {
  const easter = westernEaster(year);
  const orthodox = orthodoxEaster(year);
  return {
    year,
    ashWednesday: addDays(easter, -46),
    palmSunday: addDays(easter, -7),
    goodFriday: addDays(easter, -2),
    easter,
    easterMonday: addDays(easter, 1),
    ascension: addDays(easter, 39),
    pentecost: addDays(easter, 49),
    orthodoxGoodFriday: addDays(orthodox, -2),
    orthodoxEaster: orthodox,
    orthodoxPentecost: addDays(orthodox, 49),
    same: easter === orthodox,
    christmas: iso(year, 12, 25),
    julianChristmas: julianToGregorian(year - 1, 12, 25),
  };
}

/** `today` is a UTC calendar day, YYYY-MM-DD. */
export function easterDates(today = new Date().toISOString().slice(0, 10)): EasterDates {
  const thisYear = Number(today.slice(0, 4));
  const rows = Array.from({ length: 2 * SPAN + 1 }, (_, i) => easterYear(thisYear - SPAN + i));
  const at = today <= rows[SPAN].orthodoxEaster ? SPAN : SPAN + 1;
  return { today, thisYear, nearest: rows[at], following: rows[at + 1], rows };
}
