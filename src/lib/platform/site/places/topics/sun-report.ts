import { localClock, zoneOffset } from './sky-time';
import { dayLength, riseSet, sunDay, type Crossing, type SunDay } from './sun-times';

/** A place's sun for today and its year, on its own clock (sun-times.ts does the astronomy). */

const DAY_MS = 86_400_000;

export interface SunDate { date: string; rise: Crossing; set: Crossing; length: number }

/** From the first day to the last, which may wrap past New Year (polar night in the north). */
export interface SunSpan { from: string; to: string; days: number }

export interface SunReport {
  /** When it was worked out. */
  at: number;
  /** Today on the place's clock, YYYY-MM-DD. */
  date: string;
  today: SunDay;
  /** Today's day length minus yesterday's, ms; null across midnight sun or polar night. */
  change: number | null;
  longest: SunDate | null;
  shortest: SunDate | null;
  midnightSun: SunSpan | null;
  polarNight: SunSpan | null;
  /** The 21st of each month this year, so the solstices and equinoxes are among them. */
  months: SunDate[];
}

/** The UTC moment of 12:00 on the place's clock that date. */
export function localNoon(date: string, tz: string): number {
  const guess = Date.parse(`${date}T12:00:00Z`);
  return guess - zoneOffset(guess - zoneOffset(guess, tz), tz);
}

function datesOf(year: number): string[] {
  const out: string[] = [];
  for (let t = Date.UTC(year, 0, 1); new Date(t).getUTCFullYear() === year; t += DAY_MS) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** The longest run of days that pass, joined across New Year when it starts the year and ends it too. */
function span(days: SunDate[], keep: (d: SunDate) => boolean): SunSpan | null {
  const runs: [number, number][] = [];
  days.forEach((d, i) => {
    if (!keep(d)) return;
    const last = runs[runs.length - 1];
    if (last && last[1] === i - 1) last[1] = i;
    else runs.push([i, i]);
  });
  if (!runs.length) return null;
  const n = days.length;
  if (runs.length > 1 && runs[0][0] === 0 && runs[runs.length - 1][1] === n - 1) {
    const [first] = runs.splice(0, 1);
    const last = runs.pop()!;
    runs.push([last[0], first[1] + n]);
  }
  const [a, b] = runs.reduce((x, y) => (y[1] - y[0] > x[1] - x[0] ? y : x));
  return { from: days[a % n].date, to: days[b % n].date, days: b - a + 1 };
}

export function sunReport(lat: number, lon: number, tz: string, now: number): SunReport {
  const date = localClock(now, tz).date;
  const year = Number(date.slice(0, 4));
  const days = datesOf(year).map(d => {
    const rs = riseSet(lat, lon, localNoon(d, tz));
    return { date: d, ...rs, length: dayLength(rs) };
  });
  const ordinary = days.filter(d => typeof d.rise === 'number' && typeof d.set === 'number');
  const pick = (better: (a: SunDate, b: SunDate) => boolean) => ordinary.reduce<SunDate | null>((x, d) => (!x || better(d, x) ? d : x), null);
  const today = sunDay(lat, lon, localNoon(date, tz));
  const yesterday = riseSet(lat, lon, localNoon(new Date(Date.parse(date) - DAY_MS).toISOString().slice(0, 10), tz));
  const ordinaryDay = (d: { rise: Crossing; set: Crossing }) => typeof d.rise === 'number' && typeof d.set === 'number';
  const midnightSun = span(days, d => d.rise === 'above');
  const polarNight = span(days, d => d.rise === 'below');
  return {
    at: now,
    date,
    today,
    change: ordinaryDay(today) && ordinaryDay(yesterday) ? dayLength(today) - dayLength(yesterday) : null,
    longest: midnightSun ? null : pick((a, b) => a.length > b.length),
    shortest: polarNight ? null : pick((a, b) => a.length < b.length),
    midnightSun,
    polarNight,
    months: days.filter(d => d.date.endsWith('-21')),
  };
}
