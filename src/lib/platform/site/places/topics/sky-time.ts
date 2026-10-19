/** Wall-clock time in a place's own time zone, for the sky topics. */

export interface LocalClock {
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, 24-hour */
  time: string;
  hour: number;
  /** 0 is Sunday. */
  weekday: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short', hourCycle: 'h23' });
    formatters.set(tz, f);
  }
  return f;
}

function parts(ms: number, tz: string) {
  const out: Record<string, string> = {};
  for (const p of formatter(tz).formatToParts(ms)) out[p.type] = p.value;
  return out;
}

export function localClock(ms: number, tz: string): LocalClock {
  const p = parts(ms, tz);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, hour: Number(p.hour), weekday: WEEKDAYS.indexOf(p.weekday) };
}

/** How far the zone's clock is ahead of UTC at that moment, in ms. */
export function zoneOffset(ms: number, tz: string): number {
  const p = parts(ms, tz);
  const wall = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return wall - Math.floor(ms / 1000) * 1000;
}

const DAY = 86_400_000;
const NOON = DAY / 2;

/**
 * Which night a moment falls in, counted from the night of `now`: 0 is tonight, 1 tomorrow night. A night
 * runs from local noon to noon, so a pass before dawn belongs to the evening before it.
 */
export function nightOf(ms: number, now: number, tz: string): number {
  const day = (t: number) => Math.floor((t + zoneOffset(t, tz) - NOON) / DAY);
  return day(ms) - day(now);
}
