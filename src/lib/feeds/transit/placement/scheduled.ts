import type { RtVehicle } from '../gtfs/realtime';
import type { TransitMode } from '../modes';

/**
 * A metro that publishes no live data at all (Istanbul, İzmir), run from its published timetable: each trip
 * where its schedule has it now, between two stops. Not live, and drawn and labelled as scheduled.
 * Built by tools/transit/schedules.ts.
 */
export interface Timetable {
  tz: string;
  /** [lng, lat, name] */
  stops: [number, number, string][];
  routes: { name: string; mode: TransitMode }[];
  patterns: {
    route: number;
    /** Indices into `stops`, in running order. */
    stops: number[];
    /** Seconds from the trip's start to each stop. */
    at: number[];
    /** Weekday mask (bit 0 Monday … bit 6 Sunday) → the trips' start times, seconds after midnight, ascending. */
    starts: Record<string, number[]>;
  }[];
}

const DAY_S = 86_400;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The weekday (0 Monday) and seconds since midnight on the timetable's own clock. */
export function localClock(tz: string, at: Date): { day: number; sec: number } {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(at).map(x => [x.type, x.value]));
  return { day: WEEKDAYS.indexOf(p.weekday), sec: Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second) };
}

function bearingOf([lng1, lat1]: readonly [number, number, ...unknown[]], [lng2, lat2]: readonly [number, number, ...unknown[]]): number {
  const k = Math.PI / 180;
  const y = Math.sin((lng2 - lng1) * k) * Math.cos(lat2 * k);
  const x = Math.cos(lat1 * k) * Math.sin(lat2 * k) - Math.sin(lat1 * k) * Math.cos(lat2 * k) * Math.cos((lng2 - lng1) * k);
  return Math.round(((Math.atan2(y, x) / k) + 360) % 360);
}

/** First index whose start is after `t`. */
function upper(xs: number[], t: number) {
  let lo = 0, hi = xs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= t) lo = mid + 1; else hi = mid;
  }
  return lo;
}

/** Every trip under way at `at`, today's and those started yesterday that run past midnight. */
export function scheduledVehicles(tt: Timetable, at: Date): RtVehicle[] {
  const { day, sec } = localClock(tt.tz, at);
  const out: RtVehicle[] = [];
  const nowS = Math.round(at.getTime() / 1000);
  for (const [pi, p] of tt.patterns.entries()) {
    const run = p.at[p.at.length - 1];
    const route = tt.routes[p.route];
    for (const [d, t] of [[day, sec], [(day + 6) % 7, sec + DAY_S]] as const) {
      // Services overlap (a weekday one and a daily one): a start they share is one train.
      const masks = Object.keys(p.starts).filter(m => Number(m) & (1 << d));
      const starts = masks.length === 1 ? p.starts[masks[0]] : [...new Set(masks.flatMap(m => p.starts[m]))].sort((a, b) => a - b);
      // Starts within one run before now, newest first.
      for (let i = upper(starts, t) - 1; i >= 0 && t - starts[i] <= run; i--) {
        const gone = t - starts[i];
        const seg = Math.max(0, upper(p.at, gone) - 1);
        if (seg >= p.stops.length - 1) continue;
        const a = tt.stops[p.stops[seg]], b = tt.stops[p.stops[seg + 1]];
        const span = p.at[seg + 1] - p.at[seg];
        const share = span > 0 ? (gone - p.at[seg]) / span : 0;
        out.push({
          id: `${pi}:${d === day ? '' : 'y'}${starts[i]}`,
          lng: a[0] + (b[0] - a[0]) * share, lat: a[1] + (b[1] - a[1]) * share, bearing: bearingOf(a, b),
          route: route.name, mode: route.mode, trip: String(pi), t: nowS,
          stop: b[2], from: a[2], status: 2,
          estimated: true, scheduled: true,
        });
      }
    }
  }
  return out;
}

/** A scheduled trip's stations in running order; its `trip` is the pattern's index. */
export function patternStops(tt: Timetable | undefined, trip: string): [number, number, string][] | null {
  const p = /^\d+$/.test(trip) ? tt?.patterns[Number(trip)] : undefined;
  return tt && p ? p.stops.map(i => tt.stops[i]) : null;
}
