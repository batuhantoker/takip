import { httpJson } from '@takip/connectors/http-json';
import { decodePolyline } from './polyline';
import type { DirectionStep, DirectionsResult, ElevationPoint, TravelMode } from './schemas';

// Keyless public instance; it writes the instruction text itself and routes walking and cycling too.
const VALHALLA_BASE = 'https://valhalla1.openstreetmap.de';
const VALHALLA = `${VALHALLA_BASE}/route`;

/** Valhalla caps the shape it accepts; this many samples still describe the terrain. */
const MAX_ELEVATION_SAMPLES = 120;

/** Only the fields we read. */
interface ValhallaManeuver {
  type?: number;
  instruction?: string;
  length?: number;
  time?: number;
  begin_shape_index?: number;
}
interface ValhallaLeg {
  shape?: string;
  maneuvers?: ValhallaManeuver[];
}
interface ValhallaTrip {
  legs?: ValhallaLeg[];
  summary?: {
    length?: number;
    time?: number;
    has_highway?: boolean;
    has_toll?: boolean;
    has_ferry?: boolean;
  };
}
export interface ValhallaResponse {
  trip?: ValhallaTrip;
  /** Present when alternates are requested and the network offers a choice. */
  alternates?: Array<{ trip?: ValhallaTrip }>;
}

/** What the caller asked the router to keep off the route. */
export interface AvoidOptions {
  tolls?: boolean;
  highways?: boolean;
  ferries?: boolean;
}

/** Valhalla maneuver type to a coarse icon key. */
export function valhallaManeuverKind(type: number): string {
  if (type === 4 || type === 5 || type === 6) return 'arrive';
  if (type === 1 || type === 2 || type === 3) return 'depart';
  if (type === 15 || type === 16 || type === 17 || type === 18 || type === 19 || type === 20) return 'roundabout';
  if ([9, 10, 11].includes(type)) return 'right';
  if ([13, 14, 15].includes(type)) return 'left';
  if (type === 7 || type === 8) return 'straight';
  if (type === 25 || type === 26 || type === 27) return 'merge';
  return 'straight';
}

export function normalizeValhalla(json: ValhallaResponse, mode: TravelMode): DirectionsResult | null {
  return normalizeValhallaTrip(json?.trip, mode);
}

/** The primary route, then any alternates the engine offered. */
export function normalizeValhallaAll(json: ValhallaResponse, mode: TravelMode): DirectionsResult[] {
  const out: DirectionsResult[] = [];
  const primary = normalizeValhallaTrip(json?.trip, mode);
  if (primary) out.push(primary);
  for (const alt of json?.alternates || []) {
    const r = normalizeValhallaTrip(alt?.trip, mode);
    if (r) out.push(r);
  }
  return out;
}

function normalizeValhallaTrip(trip: ValhallaTrip | undefined, mode: TravelMode): DirectionsResult | null {
  if (!trip || !Array.isArray(trip.legs) || trip.legs.length === 0) return null;

  const coordinates: [number, number][] = [];
  const steps: DirectionStep[] = [];

  for (const leg of trip.legs) {
    const shape = decodePolyline(leg.shape || '', 6);
    // Consecutive legs share a vertex.
    coordinates.push(...(coordinates.length ? shape.slice(1) : shape));

    for (const m of leg.maneuvers || []) {
      const at = shape[m.begin_shape_index ?? 0] || shape[0] || [0, 0];
      steps.push({
        instruction: m.instruction || '',
        distance: (m.length || 0) * 1000, // requested in kilometres
        duration: m.time || 0,
        location: at,
        type: valhallaManeuverKind(m.type ?? 0),
      });
    }
  }

  if (coordinates.length === 0) return null;

  return {
    provider: 'valhalla',
    mode,
    distance: (trip.summary?.length || 0) * 1000,
    duration: trip.summary?.time || 0,
    geometry: { type: 'LineString', coordinates },
    steps,
    hasHighway: trip.summary?.has_highway,
    hasToll: trip.summary?.has_toll,
    hasFerry: trip.summary?.has_ferry,
  };
}

/** Avoidance is a 0..1 preference, not a ban: 0 means "only if there is no other way", which is what "avoid tolls" means to a user. */
export function buildCostingOptions(mode: TravelMode, avoid: AvoidOptions): Record<string, unknown> {
  const o: Record<string, number> = {};
  if (avoid.tolls) o.use_tolls = 0;
  if (avoid.highways) o.use_highways = 0;
  if (avoid.ferries) o.use_ferry = 0;
  return Object.keys(o).length ? { [mode]: o } : {};
}

export async function tryValhalla(
  points: Array<{ lat: number; lng: number }>,
  mode: TravelMode,
  avoid: AvoidOptions,
): Promise<DirectionsResult[]> {
  const costingOptions = buildCostingOptions(mode, avoid);
  const body = {
    locations: points.map((p) => ({ lat: p.lat, lon: p.lng })),
    costing: mode,
    ...(Object.keys(costingOptions).length ? { costing_options: costingOptions } : {}),
    // The engine returns these only when the network genuinely offers a choice.
    alternates: 2,
    directions_options: { units: 'kilometers' },
  };
  const url = `${VALHALLA}?json=${encodeURIComponent(JSON.stringify(body))}`;
  return normalizeValhallaAll(await httpJson<ValhallaResponse>(url), mode);
}

/** Terrain profile along a route, with ascent and descent in whole metres. */
export async function fetchElevation(
  coords: [number, number][],
): Promise<{ elevation: ElevationPoint[]; ascent: number; descent: number } | null> {
  const stride = Math.max(1, Math.ceil(coords.length / MAX_ELEVATION_SAMPLES));
  const shape = coords.filter((_, i) => i % stride === 0).map(([lon, lat]) => ({ lat, lon }));
  if (shape.length < 2) return null;

  const url = `${VALHALLA_BASE}/height?json=${encodeURIComponent(JSON.stringify({ range: true, shape }))}`;
  const json = await httpJson<{ range_height?: [number, number][] }>(url, { timeoutMs: 10000 });
  const pairs = json?.range_height;
  if (!Array.isArray(pairs) || pairs.length < 2) return null;

  const elevation: ElevationPoint[] = [];
  let ascent = 0;
  let descent = 0;
  let prev: number | null = null;
  for (const [distance, height] of pairs) {
    if (!Number.isFinite(distance) || !Number.isFinite(height)) continue;
    elevation.push({ distance, height });
    if (prev !== null) {
      const d = height - prev;
      // Sub-metre wobble is SRTM noise; counting it would inflate the totals.
      if (d > 1) ascent += d;
      else if (d < -1) descent += -d;
    }
    prev = height;
  }
  if (elevation.length < 2) return null;
  return { elevation, ascent: Math.round(ascent), descent: Math.round(descent) };
}
