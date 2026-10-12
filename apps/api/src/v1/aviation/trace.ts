import { nearestAirport, type Airport } from '@takip/connectors/airports';
import type { AircraftDetail } from './schemas';

type DepartureFix = NonNullable<AircraftDetail['departureFix']>;
type Row = Array<number | string | null>;

export interface TraceFile {
  icao?: string;
  r?: string;
  t?: string;
  desc?: string;
  ownOp?: string;
  timestamp?: number;
  /** [Δseconds, lat, lon, altitude, groundSpeed, track, flags, …] */
  trace?: Row[];
}

/** readsb shards traces by the last two characters of the hex address. */
export function shardFor(icao24: string): string {
  return icao24.trim().toLowerCase().slice(-2);
}

/**
 * Keep only the leg the aircraft is currently flying.
 *
 * A full trace covers 24 hours, which for an airliner is five or six separate
 * flights strung end to end — drawn as one polyline it reads as random lines
 * criss-crossing the country. Ground reports delimit the legs, so walk back
 * from the newest point: skip time parked, take the airborne run, and stop at
 * the previous stint on the ground.
 */
export function currentLeg(
  rows: Row[],
  /** Ground samples in a row before it counts as a real stop, not a blip. */
  minGroundRun = 4,
): Row[] {
  if (rows.length === 0) return rows;
  const isGround = (r: Row) => r?.[3] === 'ground';

  let i = rows.length - 1;
  while (i >= 0 && isGround(rows[i])) i--;   // currently parked? rewind to the flight
  if (i < 0) return rows.slice(-2);          // never left the ground in this window
  const end = i;

  // Scanning backwards, remember where each ground run *ends* (its newest
  // sample) — the leg resumes there, not at the point the run was confirmed.
  let run = 0;
  let runNewest = -1;
  let start = 0;
  while (i >= 0) {
    if (isGround(rows[i])) {
      if (run === 0) runNewest = i;
      if (++run >= minGroundRun) { start = runNewest + 1; break; }
    } else {
      run = 0;
    }
    i--;
  }
  // readsb flags the first row of each leg it detects (flags & 2). That catches
  // turnarounds with no ground reports at all, like DAL67's three hours at Rome,
  // which otherwise drew Atlanta–Rome–back as one flight.
  for (let j = end; j > start; j--) {
    const flags = rows[j]?.[6];
    if (typeof flags === 'number' && flags & 2) { start = j; break; }
  }
  const leg = rows.slice(start, end + 1);
  // A trace with no ground reports at all is one continuous leg.
  return leg.length > 1 ? leg : rows;
}

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

/** Pull identity and the flown path out of a readsb trace file. */
export function parseTrace(
  json: TraceFile,
  maxPoints = 700,
  /** Draw only the flight in progress; the full history is rarely meaningful. */
  legOnly = true,
): Omit<AircraftDetail, 'operator' | 'source'> {
  const track: [number, number][] = [];
  const altitudes: (number | null)[] = [];

  const rows = legOnly ? currentLeg(json?.trace || []) : (json?.trace || []);
  for (const row of rows) {
    const lat = row?.[1];
    const lng = row?.[2];
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    track.push([lng, lat]);
    // Altitude is feet, or the string "ground".
    const alt = row?.[3];
    altitudes.push(typeof alt === 'number' ? alt : null);
  }

  const idx = track.map((_, i) => i);
  const keep = downsample(idx, maxPoints);

  // Trailing ground reports are trimmed off the leg, so the landing has to be
  // read from the untrimmed trace.
  const raw = json?.trace || [];
  const landed = raw.length > 0 && raw[raw.length - 1]?.[3] === 'ground';

  return {
    icao24: (json?.icao || '').toLowerCase(),
    registration: json?.r?.trim() || null,
    typeCode: json?.t?.trim() || null,
    model: json?.desc?.trim() || null,
    track: keep.map((i) => track[i]),
    altitudes: keep.map((i) => altitudes[i]),
    points: keep.length,
    ...legEndpoints(track, altitudes, landed),
  };
}
