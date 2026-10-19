import { msg, type Translate } from '@/lib/core/i18n/translator';
import { localClock } from './sky-time';

/** Words shared by the ISS and aurora pages: compass points and times on the place's own clock. */

const COMPASS: Record<string, string> = {
  N: msg('north'), NE: msg('north-east'), E: msg('east'), SE: msg('south-east'),
  S: msg('south'), SW: msg('south-west'), W: msg('west'), NW: msg('north-west'),
};

export const compassWord = (point: string, t: Translate) => t(COMPASS[point] ?? point);

export const clockIn = (ms: number, tz: string, t: Translate) =>
  new Intl.DateTimeFormat(t.intl, { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms);

/** "Thursday 22 October" in the reader's language. */
export const dayIn = (ms: number, tz: string, t: Translate) =>
  new Intl.DateTimeFormat(t.intl, { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(ms);

/** "CEST", "GMT+3": what the zone is called at that moment. */
export function zoneName(ms: number, tz: string, t: Translate): string {
  const part = new Intl.DateTimeFormat(t.intl, { timeZone: tz, timeZoneName: 'short' }).formatToParts(ms).find(p => p.type === 'timeZoneName');
  return part?.value ?? tz;
}

const DAY = 86_400_000;

/** How many local calendar days after `now` the moment falls. */
function daysAfter(ms: number, now: number, tz: string): number {
  const date = (x: number) => Date.parse(`${localClock(x, tz).date}T00:00:00Z`);
  return Math.round((date(ms) - date(now)) / DAY);
}

/** "at 18:58" later today, "tomorrow at 06:05", "on Thursday 22 October at 05:44". */
export function onDay(ms: number, now: number, tz: string, t: Translate): string {
  const time = clockIn(ms, tz, t);
  const d = daysAfter(ms, now, tz);
  return d === 0 ? t('at {time}', { time }) : d === 1 ? t('tomorrow at {time}', { time }) : t('on {day} at {time}', { day: dayIn(ms, tz, t), time });
}

/**
 * A night-sky moment as people say it: "tonight at 21:14" for this evening or after midnight, "this morning",
 * "tomorrow morning", "tomorrow evening", then the weekday.
 */
export function skyWhen(ms: number, now: number, tz: string, t: Translate): string {
  const time = clockIn(ms, tz, t);
  const hour = localClock(ms, tz).hour;
  const d = daysAfter(ms, now, tz);
  const nowHour = localClock(now, tz).hour;
  if ((d === 0 && hour >= 12) || (d === 1 && hour < 4 && nowHour >= 12)) return t('tonight at {time}', { time });
  if (d === 0) return t('this morning at {time}', { time });
  if (d === 1) return hour < 12 ? t('tomorrow morning at {time}', { time }) : t('tomorrow evening at {time}', { time });
  return t('on {day} at {time}', { day: dayIn(ms, tz, t), time });
}

/** "48.1° N" */
export const latitudeOf = (lat: number, t: Translate) =>
  lat >= 0 ? t('{deg}° N', { deg: Math.round(Math.abs(lat) * 10) / 10 }) : t('{deg}° S', { deg: Math.round(Math.abs(lat) * 10) / 10 });
