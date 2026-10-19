import type { Translate } from '@/lib/core/i18n/translator';
import { formatTime } from '@/lib/map/replay/time-input';

const LONG = new Map<string, Intl.DateTimeFormat>();
const AGO = new Map<string, Intl.RelativeTimeFormat>();
const DAY_MS = 86_400_000;
const YEAR_MS = 365.2425 * DAY_MS;

/** "2 Oct 1914", or "500 BCE" before the common era. */
export const shortDate = (at: number, t?: Translate) => formatTime(at, Number.POSITIVE_INFINITY, t);

/** "2 October 1914", or "500 BCE". English reads day first, as en-GB does. */
export function longDate(at: number, t?: Translate) {
  if (new Date(at).getUTCFullYear() <= 0) return shortDate(at, t);
  const intl = t?.intl ?? 'en';
  const tag = intl === 'en' ? 'en-GB' : intl;
  let f = LONG.get(tag);
  if (!f) LONG.set(tag, (f = new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })));
  return f.format(at);
}

/** How long before `now`, or after it: "112 years ago", "8 months ago", "today", "in 34 years". */
export function ago(t: number, now: number, intl = 'en') {
  let rtf = AGO.get(intl);
  if (!rtf) AGO.set(intl, (rtf = new Intl.RelativeTimeFormat(intl, { numeric: 'auto' })));
  const sign = t > now + DAY_MS ? 1 : -1;
  const ms = Math.abs(now - t);
  if (ms >= YEAR_MS) return rtf.format(sign * Math.floor(ms / YEAR_MS), 'year');
  if (ms >= 60 * DAY_MS) return rtf.format(sign * Math.floor(ms / (YEAR_MS / 12)), 'month');
  if (ms >= 2 * DAY_MS) return rtf.format(sign * Math.floor(ms / DAY_MS), 'day');
  if (sign > 0) return rtf.format(1, 'day');
  return rtf.format(now - t >= DAY_MS ? -1 : 0, 'day');
}
