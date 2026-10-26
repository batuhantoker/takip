/**
 * A day plan's walk along the streets, from Valhalla's pedestrian routing on FOSSGIS's public server (OpenStreetMap
 * data), which the route panel's directions use too. Server only; each plan's walks are cached for weeks.
 */

export interface Walk {
  /** [lon, lat] along the streets, stop to stop. */
  coords: [number, number][];
  km: number;
  minutes: number;
}

const VALHALLA = 'https://valhalla1.openstreetmap.de/route';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';

/** Valhalla's shapes are polylines at six decimal places. */
export function decodePolyline6(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    lat += next();
    lon += next();
    coords.push([lon / 1e6, lat / 1e6]);
  }
  return coords;
}

type Trip = { trip?: { legs?: { shape?: string }[]; summary?: { length?: number; time?: number } } };

/** The walk through `stops` in their order, or null where Valhalla has none. */
export async function walkThrough(stops: readonly (readonly [number, number])[]): Promise<Walk | null> {
  if (stops.length < 2) return null;
  const body = {
    locations: stops.map(([lon, lat]) => ({ lat, lon })),
    costing: 'pedestrian',
    directions_options: { units: 'kilometers', directions_type: 'none' },
  };
  const res = await fetch(`${VALHALLA}?json=${encodeURIComponent(JSON.stringify(body))}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return null;
  const { trip } = await res.json() as Trip;
  const coords = (trip?.legs ?? []).flatMap(leg => (leg.shape ? decodePolyline6(leg.shape) : []));
  if (coords.length < 2 || !trip?.summary?.length) return null;
  return { coords, km: Math.round(trip.summary.length * 10) / 10, minutes: Math.round((trip.summary.time ?? 0) / 60) };
}
