import { nearestAirport, type Airport } from '@takip/connectors/airports';
import type { AircraftDetail } from './schemas';

type DepartureFix = NonNullable<AircraftDetail['departureFix']>;

/** An OpenSky /tracks waypoint: [unix seconds, lat, lon, barometric altitude m, true track °, on the ground]. */
export type Waypoint = [number, number | null, number | null, number | null, number | null, boolean];

const M_TO_FT = 3.28084;

/** Above this, the leg was picked up in the cruise, not seen to depart. */
const DEPARTURE_CEILING_FT = 10_000;

// The airport list is a few hundred majors, so a flat 25 km radius named
// Newark for a Cessna seen at 175 ft over Caldwell, 21 km away. Low or on the
// ground the aircraft is at its airport; the radius only widens with the
// distance a shallow climb (~200 ft/km) could have carried it.
const AT_AIRPORT_KM = 8;
const CLIMB_FT_PER_KM = 200;
const departureRadiusKm = (altFt: number | null) =>
  Math.min(25, Math.max(AT_AIRPORT_KM, (altFt ?? 0) / CLIMB_FT_PER_KM));

/**
 * Name the airports a leg was *observed* to use.
 *
 * Schedule lookups are keyed by callsign and hand back whichever leg of the
 * aircraft's day the database happens to hold, so the track is trusted
 * instead: a leg that begins low over an airport began *at* that airport, and
 * one whose trace ends in ground reports has landed at the airport under it.
 * An aircraft first seen at cruise has no knowable origin, and one still
 * airborne has no knowable destination.
 */
export function legEndpoints(
  track: [number, number][],
  altitudes: (number | null)[],
  landed: boolean,
): { departure: Airport | null; departureFix: DepartureFix | null; arrival: Airport | null } {
  if (track.length < 2) return { departure: null, departureFix: null, arrival: null };

  const firstAlt = altitudes[0];
  const lowStart = firstAlt === null || (typeof firstAlt === 'number' && firstAlt <= DEPARTURE_CEILING_FT);
  const departureFix = lowStart
    ? { lng: track[0][0], lat: track[0][1], radiusKm: departureRadiusKm(firstAlt) }
    : null;
  const departure = departureFix ? nearestAirport(departureFix.lat, departureFix.lng, departureFix.radiusKm) : null;

  const last = track[track.length - 1];
  const arrival = landed ? nearestAirport(last[1], last[0], AT_AIRPORT_KM) : null;

  return { departure, departureFix, arrival };
}

/** Thin to at most `max` points, keeping the first and last so the path still starts and ends where it did. */
export function downsample<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)]);
  return out;
}

/** The flown path of the flight in progress, from OpenSky's waypoints for it, oldest first. */
export function parseTrack(
  path: Waypoint[] | null | undefined,
  maxPoints = 700,
): Pick<AircraftDetail, 'track' | 'altitudes' | 'points' | 'departure' | 'departureFix' | 'arrival'> {
  const track: [number, number][] = [];
  const altitudes: (number | null)[] = [];
  for (const [, lat, lng, alt, , ground] of path ?? []) {
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    track.push([lng, lat]);
    altitudes.push(ground || alt == null ? null : Math.round(alt * M_TO_FT));
  }

  const keep = downsample(track.map((_, i) => i), maxPoints);
  const landed = !!path?.length && path[path.length - 1]?.[5] === true;

  return {
    track: keep.map((i) => track[i]),
    altitudes: keep.map((i) => altitudes[i]),
    points: keep.length,
    ...legEndpoints(track, altitudes, landed),
  };
}
