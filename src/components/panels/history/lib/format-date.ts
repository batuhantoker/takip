import { formatTime } from '@/lib/replay/time-input';

const LONG = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const DAY_MS = 86_400_000;
const YEAR_MS = 365.2425 * DAY_MS;

/** "2 Oct 1914", or "500 BCE" before the common era. */
export const shortDate = (t: number) => formatTime(t, Number.POSITIVE_INFINITY);

/** "2 October 1914", or "500 BCE". */
export const longDate = (t: number) => (new Date(t).getUTCFullYear() <= 0 ? shortDate(t) : LONG.format(t));

const count = (n: number, one: string) => `${n.toLocaleString('en')} ${one}${n === 1 ? '' : 's'} ago`;

/** How long before `now`: "112 years ago", "8 months ago", "today". */
export function ago(t: number, now: number) {
  const ms = now - t;
  if (ms >= YEAR_MS) return count(Math.floor(ms / YEAR_MS), 'year');
  if (ms >= 60 * DAY_MS) return count(Math.floor(ms / (YEAR_MS / 12)), 'month');
  if (ms >= 2 * DAY_MS) return count(Math.floor(ms / DAY_MS), 'day');
  return ms >= DAY_MS ? 'yesterday' : 'today';
}
