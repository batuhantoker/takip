import { htmlEsc } from '@/lib/map/popups/kit';
import { MODE_LABEL, type TransitMode } from './modes';

type Props = Record<string, unknown>;

const ROAD = new Set<TransitMode>(['bus', 'trolleybus']);

/** GTFS-RT VehicleStopStatus. */
export const TRANSIT_STATUS = ['Arriving at a stop', 'At a stop', 'Between stops'];

const num = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const text = (v: unknown) => (v == null ? '' : String(v).trim());

export function transitAgo(age: unknown): string | undefined {
  const s = num(age);
  if (s == null) return undefined;
  if (s < 60) return `${Math.round(s)} s ago`;
  return `${Math.round(s / 60)} min ago`;
}

export const transitKmh = (speed: unknown) => {
  const ms = num(speed);
  return ms == null ? null : Math.round(ms * 3.6);
};

/** A route id a rider would recognise ("34A", "Green-B"), not an internal one ("NBU:Line:cb7b…"). */
export const readableRoute = (route: unknown) => {
  const r = text(route);
  return r && r.length <= 16 && !/[:/]/.test(r) ? r : '';
};

const modeOf = (p: Props) => (text(p.mode) in MODE_LABEL ? (text(p.mode) as TransitMode) : null);

/** "Route 34A" for a bus, "Metro A" or "Tram 9" for the rest; the vehicle's own label when the route is missing or an internal id. */
export function transitTitle(p: Props): string {
  const route = readableRoute(p.route), label = text(p.label), mode = modeOf(p);
  if (route) return mode && !ROAD.has(mode) ? `${MODE_LABEL[mode]} ${route}` : `Route ${route}`;
  return label ? `Vehicle ${label}` : mode && !ROAD.has(mode) ? MODE_LABEL[mode] : 'Transit vehicle';
}

/** Where a vehicle placed by its stops is: "At Fulton St", "Between 59 St and 86 St". Null for a GPS fix. */
export function transitWhere(p: Props): string | null {
  const stop = text(p.stop), from = text(p.from);
  if (!stop) return null;
  const status = num(p.status);
  if (status === 1) return `At ${stop}`;
  if (status === 0) return `Arriving at ${stop}`;
  return from ? `Between ${from} and ${stop}` : `Heading to ${stop}`;
}

/** The hover line under the title: who runs it, and how fast it is going or which stops it is between. */
export function transitTipMeta(p: Props, mono: (s: string) => string): string {
  const kmh = transitKmh(p.speed);
  const who = text(p.operator) || text(p.feed);
  const where = transitWhere(p);
  const how = where ? htmlEsc(where) : kmh == null ? null : kmh < 2 ? 'stopped' : mono(`${kmh} km/h`);
  return [who && htmlEsc(who), how, String(p.scheduled) === 'true' ? 'scheduled' : null].filter(Boolean).join(' · ');
}
