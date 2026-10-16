import { formatTime } from '@/lib/map/replay/time-input';

const LONG = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const DAY_MS = 86_400_000;
const YEAR_MS = 365.2425 * DAY_MS;

/** "2 Oct 1914", or "500 BCE" before the common era. */
export const shortDate = (t: number) => formatTime(t, Number.POSITIVE_INFINITY);

/** "2 October 1914", or "500 BCE". */
export const longDate = (t: number) => (new Date(t).getUTCFullYear() <= 0 ? shortDate(t) : LONG.format(t));

const units = (n: number, one: string) => `${n.toLocaleString('en')} ${one}${n === 1 ? '' : 's'}`;

/** How long before `now`, or after it: "112 years ago", "8 months ago", "today", "in 34 years". */
export function ago(t: number, now: number) {
  const ahead = t > now + DAY_MS;
  const ms = Math.abs(now - t);
  const span = ms >= YEAR_MS ? units(Math.floor(ms / YEAR_MS), 'year')
    : ms >= 60 * DAY_MS ? units(Math.floor(ms / (YEAR_MS / 12)), 'month')
      : ms >= 2 * DAY_MS ? units(Math.floor(ms / DAY_MS), 'day')
        : null;
  if (span) return ahead ? `in ${span}` : `${span} ago`;
  if (ahead) return 'tomorrow';
  return now - t >= DAY_MS ? 'yesterday' : 'today';
}
