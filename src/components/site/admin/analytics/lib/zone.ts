// `zone` is an IANA name; left out, it is the viewer's own, as the browser has it.

/** The viewer's IANA zone, for the api's local days. */
export const viewerZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

function parts(at: number, zone?: string) {
  const list = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(at);
  return Object.fromEntries(list.map(p => [p.type, p.value])) as Record<'year' | 'month' | 'day' | 'hour' | 'minute', string>;
}

/** The zone's short name at `at`: 'EDT', 'GMT+3'. */
export const zoneName = (at = Date.now(), zone?: string) =>
  new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'short' }).formatToParts(at).find(p => p.type === 'timeZoneName')?.value ?? 'local time';

/** The date holding `at` in the zone, as 'YYYY-MM-DD'. */
export function localIsoDay(at: number, zone?: string) {
  const p = parts(at, zone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** 'HH:MM' at `at` in the zone. */
export function localClock(at: number, zone?: string) {
  const p = parts(at, zone);
  return `${p.hour}:${p.minute}`;
}

/** How far the zone's clocks are ahead of UTC at `at`, in minutes. */
export function offsetMinutes(at: number, zone?: string) {
  const p = parts(at, zone);
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(at / 60_000) * 60_000) / 60_000);
}

/**
 * Weekday × hour cells kept in UTC (dow 0 = Sunday), moved to the zone by its offset now, with the zone's name. A zone
 * a half hour off UTC can't move whole hours, so its cells stay in UTC and say so.
 */
export function localWeekHours<T extends { dow: number; hour: number }>(cells: T[], zone?: string, at = Date.now()) {
  const offset = offsetMinutes(at, zone);
  if (offset % 60) return { cells, zone: 'UTC' };
  return {
    cells: cells.map(c => {
      const hourOfWeek = (c.dow * 24 + c.hour + offset / 60 + 168) % 168;
      return { ...c, dow: Math.floor(hourOfWeek / 24), hour: hourOfWeek % 24 };
    }),
    zone: zoneName(at, zone),
  };
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** A chart card's table of UTC weekday × hour minutes, moved to the viewer's clock and busiest first, and that clock's name. */
export function weekHourTable(utc: { dow: number; hour: number; minutes: number }[]) {
  const { cells, zone } = localWeekHours(utc);
  return {
    zone,
    columns: [`Weekday and hour (${zone})`, 'Minutes'],
    rows: [...cells].sort((x, y) => y.minutes - x.minutes).map(h => [`${DAY_NAMES[h.dow]} ${String(h.hour).padStart(2, '0')}:00`, h.minutes]),
  };
}
