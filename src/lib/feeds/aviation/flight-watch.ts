/** Flight Watch, minus the UI: aircraft types, great-circle distance and which airports to trust. */

import { createTranslator, type Translate } from '@/lib/core/i18n/translator';

const english = createTranslator('en', {});

export interface WatchedFlight {
  icao24: string;
  callsign: string;
  category?: string;
}

/** Live telemetry, refreshed from the flights feed. */
export interface FlightTelemetry {
  lat: number;
  lng: number;
  alt: number;
  speed_knots: number;
  heading: number;
  grounded?: boolean;
  squawk?: string;
}

export interface Airport {
  icao: string;
  iata?: string;
  city?: string;
  lat: number;
  lng: number;
}

export interface AircraftDetail {
  icao24: string;
  registration: string | null;
  typeCode: string | null;
  model: string | null;
  operator: string | null;
  track: [number, number][];
  points: number;
  /** Airports read off the track: where this leg was seen to leave and land. */
  departure?: Airport | null;
  /** Where the leg was seen to begin, even when that airport is not in the list. */
  departureFix?: { lng: number; lat: number; radiusKm: number } | null;
  arrival?: Airport | null;
  /** Endpoints the map should pin — observed where possible, schedule where not. */
  origin?: Airport | null;
  destination?: Airport | null;
}

/** Schedule lookup result from /api/v1/flight-route. */
export interface ScheduledRoute {
  found?: boolean;
  origin?: Airport | null;
  destination?: Airport | null;
}

const R_KM = 6371;

export function greatCircleKm(a: [number, number], b: [number, number]): number {
  const t = Math.PI / 180;
  const dLat = (b[1] - a[1]) * t;
  const dLng = (b[0] - a[0]) * t;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(a[1] * t) * Math.cos(b[1] * t) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(h));
}

export const sameAirport = (a: Airport, b: Airport) =>
  a.icao === b.icao || (Boolean(a.iata) && a.iata === b.iata);

/**
 * Is the aircraft actually inside the corridor between these two airports?
 *
 * Flying O→D means the legs either side of you add up to about the whole trip.
 * A wrong-leg schedule fails loudly — one sampled aircraft measured 32× the
 * direct distance out of its supposed corridor.
 */
export function onCorridor(here: [number, number], origin: Airport, destination: Airport): boolean {
  const direct = greatCircleKm([origin.lng, origin.lat], [destination.lng, destination.lat]);
  const fromOrigin = greatCircleKm([origin.lng, origin.lat], here);
  const toDestination = greatCircleKm(here, [destination.lng, destination.lat]);
  // Short hops spend a bigger share of the trip on departure and arrival
  // vectoring, so allow a fixed slice of slack on top of the proportional one.
  const slack = 150;
  // Farther from one end than the whole trip is long: beyond it, not between.
  if (fromOrigin > direct + slack || toDestination > direct + slack) return false;
  return fromOrigin + toDestination <= direct * 1.15 + slack;
}

/**
 * Does a schedule describe the leg this aircraft is flying?
 *
 * A seen departure decides: by airport, or — when that airport is not in the
 * list — by where the leg began, which caught RPA3551 rising out of Portland
 * on a schedule that said Boston. Only with no departure seen at all does the
 * corridor test stand in.
 */
export function scheduleAgrees(
  ac: Pick<AircraftDetail, 'departure' | 'departureFix'> | null,
  origin: Airport,
  destination: Airport,
  here: [number, number],
): boolean {
  if (ac?.departure) return sameAirport(ac.departure, origin);
  const fix = ac?.departureFix;
  if (fix) return greatCircleKm([fix.lng, fix.lat], [origin.lng, origin.lat]) <= fix.radiusKm;
  return onCorridor(here, origin, destination);
}

/**
 * Decide which airports are safe to put on the map.
 *
 * Schedule lookups are keyed by callsign, and across a live sample they named
 * the wrong leg of the aircraft's day about four times in five — origins over
 * a thousand kilometres from where the track began. Drawn, that is a dot in
 * open country with a straight line to nowhere, which is exactly what this
 * used to look like.
 *
 * So the track leads and the schedule corroborates: the departure the aircraft
 * was seen to make is the origin, and the schedule's destination is only
 * accepted when its origin agrees with that departure. With no observed
 * departure to check against — coverage that began mid-ocean — the corridor
 * test stands in. Failing both, nothing is drawn.
 */
export function resolveEndpoints(
  ac: AircraftDetail,
  schedule: ScheduledRoute | null,
): { origin: Airport | null; destination: Airport | null } {
  const observedDep = ac.departure || null;
  const observedArr = ac.arrival || null;
  const sched = schedule?.found ? schedule : null;
  const here = ac.track.length ? ac.track[ac.track.length - 1] : null;

  // Already landed: both ends were watched happening, nothing to corroborate.
  if (observedDep && observedArr) return { origin: observedDep, destination: observedArr };

  let destination: Airport | null = observedArr;
  if (!destination && sched?.origin && sched?.destination && here
      && scheduleAgrees(ac, sched.origin, sched.destination, here)) {
    destination = sched.destination;
  }

  return { origin: observedDep, destination };
}

/** Feet is what aviation actually uses; the feed reports metres. */
export function toFeet(metres: number): number {
  return Math.round((metres * 3.28084) / 25) * 25;
}

export function formatAlt(metres: number | undefined, grounded?: boolean, t: Translate = english): string {
  if (grounded) return t('Ground');
  if (typeof metres !== 'number' || !Number.isFinite(metres)) return '—';
  return `${toFeet(metres).toLocaleString(t.intl)} ft`;
}
