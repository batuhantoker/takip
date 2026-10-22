import { DAY_MS } from '../access/usage';

const formats = new Map<string, Intl.DateTimeFormat>();

function formatOf(zone: string) {
  let format = formats.get(zone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    formats.set(zone, format);
  }
  return format;
}

/** An IANA zone name this runtime knows ('Europe/Istanbul', 'UTC'). */
export function isZone(name: string) {
  try {
    formatOf(name);
    return true;
  } catch {
    return false;
  }
}

/** How far `zone`'s clocks are ahead of UTC at `at`, in ms. */
export function zoneOffsetMs(zone: string, at: number) {
  const parts = Object.fromEntries(formatOf(zone).formatToParts(at).map(p => [p.type, Number(p.value)]));
  const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return wall - Math.floor(at / 1000) * 1000;
}

/** The local date holding `at` in `zone`, as days since 1970-01-01. */
export const localDay = (zone: string, at: number) => Math.floor((at + zoneOffsetMs(zone, at)) / DAY_MS);

/** When local day `day` (days since 1970-01-01) begins in `zone`, in ms. */
export function localMidnight(zone: string, day: number) {
  const wall = day * DAY_MS;
  const guess = wall - zoneOffsetMs(zone, wall);
  // A second look settles a midnight on the other side of a clock change.
  return wall - zoneOffsetMs(zone, guess);
}
