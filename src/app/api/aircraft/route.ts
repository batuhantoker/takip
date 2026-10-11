import { NextResponse } from 'next/server';
import { httpJson, optional } from '@/lib/httpJson';
import { cachedSource } from '@/lib/sourceCache';
import { nearestAirport, type Airport } from '@/lib/airports';

export const maxDuration = 20;

/**
 * OSIRIS — Aircraft identity and flown track.
 *
 * The live feed only carries what the transponder broadcasts, so `model` came
 * through as "Unknown" for most airliners and as a bare ICAO type code ("H60")
 * for the rest. And the route line was drawn straight between two airports,
 * which is not the path the aircraft actually flew — an orbit or a hold showed
 * as a straight line to the destination.
 *
 * adsb.lol publishes readsb trace files that answer both at once: the real
 * flown track, plus the aircraft's registration, type code and full model name.
 * adsbdb fills in the registered operator, which the traces do not carry.
 */

const TRACE_BASE = 'https://adsb.lol/data/traces';
const ADSBDB = 'https://api.adsbdb.com/v0/aircraft';
// adsb.fi's aircraft database is refreshed more often than the one stamped into
// adsb.lol's traces, so it still names airframes those two leave blank.
const ADSBFI_HEX = 'https://opendata.adsb.fi/api/v2/hex';

export interface AircraftDetail {
  icao24: string;
  registration: string | null;
  typeCode: string | null;
  /** Full human model, e.g. "BOEING 737-800" or "Sikorsky MH-60T Jayhawk". */
  model: string | null;
  operator: string | null;
  /** Actual flown path as [lng, lat], oldest first. */
  track: [number, number][];
  /** Altitude in feet at each track point, aligned by index. */
  altitudes: (number | null)[];
  points: number;
  /** Airport this leg was seen to leave, read off the track. Null if unknown. */
  departure: Airport | null;
  /**
   * Where the leg was seen to begin, low enough to have just departed. Set even
   * when that airport is not in the list, so a schedule can still be checked.
   */
  departureFix: DepartureFix | null;
  /** Airport this leg was seen to land at. Null while still airborne. */
  arrival: Airport | null;
  source: string;
}

export interface DepartureFix {
  lng: number;
  lat: number;
  /** The airport it left is within this distance. */
  radiusKm: number;
}

/** readsb shards traces by the last two characters of the hex address. */
export function shardFor(icao24: string): string {
  return icao24.trim().toLowerCase().slice(-2);
}

interface TraceFile {
  icao?: string;
  r?: string;
  t?: string;
  desc?: string;
  ownOp?: string;
  timestamp?: number;
  /** [Δseconds, lat, lon, altitude, groundSpeed, track, flags, …] */
  trace?: Array<Array<number | string | null>>;
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
  rows: Array<Array<number | string | null>>,
  /** Ground samples in a row before it counts as a real stop, not a blip. */
  minGroundRun = 4,
): Array<Array<number | string | null>> {
  if (rows.length === 0) return rows;
  const isGround = (r: Array<number | string | null>) => r?.[3] === 'ground';

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
 * aircraft's day the database happens to hold — measured against the flown
 * track, the origin they claim is typically over a thousand kilometres out,
 * which is what turned the drawn route into lines to nowhere. The track knows
 * better: a leg that begins low over an airport began *at* that airport, and
 * one whose trace ends in ground reports has landed at the airport under it.
 *
 * Anything else stays null. An aircraft first seen at cruise has no knowable
 * origin, and one still airborne has no knowable destination.
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

/**
 * Thin a track to at most `max` points, always keeping the first and last so
 * the path still starts and ends where the aircraft did. A 5,000-point trace
 * is ~120 KB and renders no better than a few hundred at map scale.
 */
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

interface AdsbdbResponse {
  response?: {
    aircraft?: {
      manufacturer?: string;
      type?: string;
      registered_owner?: string;
      registration?: string;
      icao_type?: string;
    };
  };
}

type AdsbdbAircraft = NonNullable<NonNullable<AdsbdbResponse['response']>['aircraft']>;

interface AdsbFiAircraft {
  r?: string;
  t?: string;
  desc?: string;
  ownOp?: string;
}

type Identity = Pick<AircraftDetail, 'registration' | 'typeCode' | 'model' | 'operator'>;

/** Each field from the first source that has it: trace, then adsbdb, then adsb.fi. */
export function mergeIdentity(
  trace: Pick<AircraftDetail, 'registration' | 'typeCode' | 'model'> | null,
  db: AdsbdbAircraft | null | undefined,
  live: AdsbFiAircraft | null | undefined,
): Identity {
  const dbModel = db?.manufacturer && db?.type ? `${db.manufacturer} ${db.type}` : db?.type;
  return {
    registration: trace?.registration || db?.registration || live?.r?.trim() || null,
    typeCode: trace?.typeCode || db?.icao_type || live?.t?.trim() || null,
    model: trace?.model || dbModel || live?.desc?.trim() || null,
    operator: db?.registered_owner || live?.ownOp?.trim() || null,
  };
}

async function fetchTrace(icao24: string, full: boolean): Promise<TraceFile> {
  const kind = full ? 'full' : 'recent';
  const url = `${TRACE_BASE}/${shardFor(icao24)}/trace_${kind}_${icao24.toLowerCase()}.json`;
  return httpJson<TraceFile>(url, { timeoutMs: 12000 });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const icao24 = (searchParams.get('icao24') || '').trim().toLowerCase();
    const full = searchParams.get('detail') !== 'recent';
    // ?legs=all draws the whole 24h history instead of just this flight.
    const legOnly = searchParams.get('legs') !== 'all';

    if (!/^[0-9a-f]{6}$/.test(icao24)) {
      return NextResponse.json({ error: 'icao24 must be a 6-character hex address' }, { status: 400 });
    }

    const detail = await cachedSource<AircraftDetail>(
      `aircraft:${icao24}:${full ? 'full' : 'recent'}:${legOnly ? 'leg' : 'all'}`,
      async () => {
        const [trace, db] = await Promise.all([
          optional(fetchTrace(icao24, full)),
          optional(httpJson<AdsbdbResponse>(`${ADSBDB}/${icao24}`, { timeoutMs: 8000 })),
        ]);

        const ac = db?.response?.aircraft;
        const parsed = trace ? parseTrace(trace, 700, legOnly) : null;

        let identity = mergeIdentity(parsed, ac, null);
        if (!identity.registration || !identity.typeCode) {
          const live = await optional(httpJson<{ ac?: AdsbFiAircraft[] }>(`${ADSBFI_HEX}/${icao24}`, { timeoutMs: 6000 }));
          identity = mergeIdentity(parsed, ac, live?.ac?.[0]);
        }

        // No source knew this airframe.
        if (!parsed && !identity.registration && !identity.typeCode && !identity.model) return [];

        return [{
          icao24,
          ...identity,
          track: parsed?.track || [],
          altitudes: parsed?.altitudes || [],
          points: parsed?.points || 0,
          departure: parsed?.departure || null,
          departureFix: parsed?.departureFix || null,
          arrival: parsed?.arrival || null,
          source: parsed ? 'adsb.lol' : ac ? 'adsbdb' : 'adsb.fi',
        }];
      },
      // Identity is effectively static; the track only matters for the current
      // leg, so a couple of minutes keeps the line fresh without hammering.
      2 * 60 * 1000,
    )();

    if (!detail.length) {
      return NextResponse.json({ error: 'Aircraft not found', icao24 }, { status: 404 });
    }

    return NextResponse.json(detail[0], {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
    });
  } catch (error) {
    console.error('[OSIRIS] Aircraft lookup error:', error);
    return NextResponse.json({ error: 'Aircraft lookup failed' }, { status: 500 });
  }
}
