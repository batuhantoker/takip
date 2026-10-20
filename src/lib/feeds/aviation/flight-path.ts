/**
 * TAKIP — the route drawn for a clicked aircraft.
 *
 * What was flown comes from the aircraft's reported track and is drawn solid.
 * What is still ahead is only known when a schedule agrees with that track, and
 * is drawn dashed along the great circle, since it is a projection rather than
 * an observation.
 */

import {
  greatCircleKm,
  sameAirport,
  scheduleAgrees,
  type AircraftDetail,
  type Airport,
  type ScheduledRoute,
} from './flight-watch';

type LngLat = [number, number];

export interface FlightRoute {
  origin: Airport | null;
  destination: Airport | null;
  /** The schedule agreed with what the aircraft was seen doing. */
  scheduled: boolean;
}

/**
 * The airports to show for an aircraft at `here`.
 *
 * Unlike the watch panel this keeps the schedule's origin when the schedule
 * passes, so the popup can still say where a flight first seen at cruise is from.
 */
export function routeFor(
  ac: Pick<AircraftDetail, 'departure' | 'departureFix' | 'arrival'> | null,
  schedule: ScheduledRoute | null,
  here: LngLat,
): FlightRoute {
  const dep = ac?.departure ?? null;
  const arr = ac?.arrival ?? null;
  const so = schedule?.found ? schedule.origin : null;
  const sd = schedule?.found ? schedule.destination : null;

  if (so && sd && scheduleAgrees(ac, so, sd, here)) {
    return { origin: dep ?? so, destination: arr ?? sd, scheduled: true };
  }
  return { origin: dep, destination: arr, scheduled: false };
}

/** Initial bearing from a to b, degrees clockwise from north. */
export function bearing(a: LngLat, b: LngLat): number {
  const t = Math.PI / 180;
  const y = Math.sin((b[0] - a[0]) * t) * Math.cos(b[1] * t);
  const x = Math.cos(a[1] * t) * Math.sin(b[1] * t)
    - Math.sin(a[1] * t) * Math.cos(b[1] * t) * Math.cos((b[0] - a[0]) * t);
  return ((Math.atan2(y, x) / t) + 360) % 360;
}

/** Points along the great circle from a to b, one every ~100 km. */
export function greatCircle(a: LngLat, b: LngLat): LngLat[] {
  const km = greatCircleKm(a, b);
  if (km < 1) return [a, b];
  const n = Math.min(128, Math.ceil(km / 100));
  const t = Math.PI / 180;
  const [l1, p1, l2, p2] = [a[0] * t, a[1] * t, b[0] * t, b[1] * t];
  const d = km / 6371;
  // Endpoints are kept exact so the line meets the aircraft and the airport.
  const out: LngLat[] = [a];
  for (let i = 1; i < n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
    const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
    const z = A * Math.sin(p1) + B * Math.sin(p2);
    out.push([Math.atan2(y, x) / t, Math.atan2(z, Math.hypot(x, y)) / t]);
  }
  out.push(b);
  return out;
}

/**
 * Make longitudes continuous so a line crossing the antimeridian goes the short
 * way instead of across the whole map. `startLng` pins the first point to an
 * existing world copy, so a continuation joins the line it continues.
 */
export function unwrap(line: LngLat[], startLng?: number): LngLat[] {
  if (line.length === 0) return line;
  const out: LngLat[] = [];
  let prev = startLng ?? line[0][0];
  for (const [lng, lat] of line) {
    let x = lng;
    while (x - prev > 180) x -= 360;
    while (x - prev < -180) x += 360;
    out.push([x, lat]);
    prev = x;
  }
  return out;
}

/**
 * The trace and the feed refresh on different clocks. A position counts as ahead of the track's end only
 * when it lies forward of the heading; joining one that lags behind would draw the line doubling back.
 */
function isAhead(end: LngLat, here: LngLat, heading: number) {
  const off = Math.abs(((bearing(end, here) - heading + 540) % 360) - 180);
  return greatCircleKm(end, here) > 1 && off < 90;
}

/** The flown track with a newer reported position on the end, when that position is ahead of it. */
export function extendTrack(track: LngLat[], here: LngLat, heading: number): LngLat[] {
  const end = track[track.length - 1];
  if (!end) return [here];
  return isAhead(end, here, heading) ? [...track, here] : track;
}

export interface PathInput {
  /** Reported track for the current leg, oldest first. */
  track: LngLat[];
  /** Where the live feed puts the aircraft. */
  here: LngLat;
  heading: number;
  origin: Airport | null;
  destination: Airport | null;
  /** Seen to land: nothing is left to fly. */
  landed?: boolean;
}

type PathFeature = GeoJSON.Feature<GeoJSON.LineString | GeoJSON.Point, { kind: string; label?: string }>;

export function flightPathFeatures({ track, here, heading, origin, destination, landed = false }: PathInput): GeoJSON.FeatureCollection {
  const features: PathFeature[] = [];
  const flown = unwrap(track);
  let front: LngLat = here;

  if (flown.length) {
    const end = flown[flown.length - 1];
    if (isAhead(end, here, heading)) {
      flown.push(unwrap([end, here], end[0])[1]);
      front = flown[flown.length - 1];
    } else {
      front = end;
    }
    if (flown.length > 1) {
      features.push({ type: 'Feature', properties: { kind: 'flown' }, geometry: { type: 'LineString', coordinates: flown } });
    }
  }

  if (destination && !landed) {
    const ahead = unwrap(greatCircle(front, [destination.lng, destination.lat]), front[0]);
    features.push({ type: 'Feature', properties: { kind: 'ahead' }, geometry: { type: 'LineString', coordinates: ahead } });
  }

  for (const ap of [origin, destination]) {
    if (!ap || !Number.isFinite(ap.lat) || !Number.isFinite(ap.lng)) continue;
    if (ap === destination && origin && sameAirport(origin, destination)) continue;
    features.push({
      type: 'Feature',
      properties: { kind: 'airport', label: ap.iata || ap.icao },
      geometry: { type: 'Point', coordinates: [ap.lng, ap.lat] },
    });
  }

  return { type: 'FeatureCollection', features };
}
