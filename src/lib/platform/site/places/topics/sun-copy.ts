import type { Translate } from '@/lib/core/i18n/translator';
import { clockIn } from './sky-copy';
import { localClock } from './sky-time';
import type { Crossing } from './sun-times';

/** The sun page's words: lengths of day and times on the place's clock. */

/** "14 h 08 min" */
export function hoursOf(ms: number, t: Translate): string {
  const min = Math.round(ms / 60_000);
  return t('{h} h {m} min', { h: Math.floor(min / 60), m: String(min % 60).padStart(2, '0') });
}

/** "2 min 41 s longer than yesterday" */
export function changeOf(ms: number, t: Translate): string {
  const s = Math.round(ms / 1000);
  if (s === 0) return t('the same as yesterday');
  const a = Math.abs(s);
  const amount = a >= 60 ? t('{m} min {s} s', { m: Math.floor(a / 60), s: a % 60 }) : t('{s} s', { s: a });
  return s > 0 ? t('{amount} longer than yesterday', { amount }) : t('{amount} shorter than yesterday', { amount });
}

/** The time on the place's clock, marked when it falls on the next or previous calendar day (a sunset after midnight). */
export function timeOn(ms: number, date: string, tz: string, t: Translate): string {
  const time = clockIn(ms, tz, t);
  const d = localClock(ms, tz).date;
  return d === date ? time : d > date ? t('{time} (next day)', { time }) : t('{time} (previous day)', { time });
}

/** A twilight's start or end: the time, or that the sky never gets that dark or that light today. */
export function twilightAt(c: Crossing, date: string, tz: string, t: Translate): string {
  if (typeof c === 'number') return timeOn(c, date, tz, t);
  return c === 'above' ? t('lasts all night') : t('not today');
}

/** Sunrise or sunset: the time, or why there is none. */
export function sunAt(c: Crossing, date: string, tz: string, t: Translate): string {
  if (typeof c === 'number') return timeOn(c, date, tz, t);
  return c === 'above' ? t('midnight sun') : t('polar night');
}

/** "21 June" in the reader's language; dates are the place's calendar days. */
export const dateIn = (date: string, t: Translate) =>
  new Intl.DateTimeFormat(t.intl, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(Date.parse(`${date}T12:00:00Z`));

/** "18.9° E" */
export const longitudeOf = (lon: number, t: Translate) =>
  lon >= 0 ? t('{deg}° E', { deg: Math.round(Math.abs(lon) * 10) / 10 }) : t('{deg}° W', { deg: Math.round(Math.abs(lon) * 10) / 10 });
