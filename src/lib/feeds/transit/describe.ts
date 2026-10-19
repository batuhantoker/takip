import { t as activeT } from '@/lib/core/i18n/active';
import { msg, type Vars } from '@/lib/core/i18n/translator';
import { htmlEsc } from '@/lib/map/popups/kit';
import { MODE_LABEL, type TransitMode } from './modes';

type Props = Record<string, unknown>;
type Say = (source: string, vars?: Vars) => string;

const ROAD = new Set<TransitMode>(['bus', 'trolleybus']);

/** GTFS-RT VehicleStopStatus. */
export const TRANSIT_STATUS = [msg('Arriving at a stop'), msg('At a stop'), msg('Between stops')];

const num = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const text = (v: unknown) => (v == null ? '' : String(v).trim());

export function transitAgo(age: unknown, t: Say = activeT): string | undefined {
  const s = num(age);
  if (s == null) return undefined;
  if (s < 60) return t('{n} s ago', { n: Math.round(s) });
  return t('{n} min ago', { n: Math.round(s / 60) });
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
export function transitTitle(p: Props, t: Say = activeT): string {
  const route = readableRoute(p.route), label = text(p.label), mode = modeOf(p);
  if (route) return mode && !ROAD.has(mode) ? `${t(MODE_LABEL[mode])} ${route}` : t('Route {route}', { route });
  return label ? t('Vehicle {label}', { label }) : mode && !ROAD.has(mode) ? t(MODE_LABEL[mode]) : t('Transit vehicle');
}

/** Where a vehicle placed by its stops is: "At Fulton St", "Between 59 St and 86 St". Null for a GPS fix. */
export function transitWhere(p: Props, t: Say = activeT): string | null {
  const stop = text(p.stop), from = text(p.from);
  if (!stop) return null;
  const status = num(p.status);
  if (status === 1) return t('At {stop}', { stop });
  if (status === 0) return t('Arriving at {stop}', { stop });
  return from ? t('Between {from} and {stop}', { from, stop }) : t('Heading to {stop}', { stop });
}

/** The hover line under the title: who runs it, and how fast it is going or which stops it is between. */
export function transitTipMeta(p: Props, mono: (s: string) => string, t: Say = activeT): string {
  const kmh = transitKmh(p.speed);
  const who = text(p.operator) || text(p.feed);
  const where = transitWhere(p, t);
  const how = where ? htmlEsc(where) : kmh == null ? null : kmh < 2 ? htmlEsc(t('stopped')) : mono(`${kmh} km/h`);
  return [who && htmlEsc(who), how, String(p.scheduled) === 'true' ? htmlEsc(t('scheduled')) : null].filter(Boolean).join(' · ');
}
