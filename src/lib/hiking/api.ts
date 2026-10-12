import { fromMercator, type MercatorBox } from './mercator';
import { WMT_API } from './overlay';

/** A route as the Waymarked Trails listings return it. */
export interface RouteSummary {
  id: number;
  name?: string;
  /** The name in the local language, when `name` is a translation. */
  local_name?: string;
  ref?: string;
  /** INT, NAT, REG or LOC, or a special network such as the Swiss AL1–AL4 grades. */
  group: string;
  itinerary?: string[];
  symbol_id?: string;
  symbol_description?: string;
}

const box = (b: MercatorBox) => b.map(n => Math.round(n)).join(',');

/** Top-level routes with a segment inside the box, most important first. */
export async function routesAt(b: MercatorBox, signal?: AbortSignal): Promise<RouteSummary[]> {
  const res = await fetch(`${WMT_API}/list/by_area?bbox=${box(b)}&limit=20`, { signal });
  if (!res.ok) throw new Error(`Waymarked Trails HTTP ${res.status}`);
  const json = await res.json();
  const results: unknown[] = Array.isArray(json?.results) ? json.results : [];
  return results.filter((r): r is RouteSummary => Number.isInteger((r as RouteSummary)?.id) && typeof (r as RouteSummary).group === 'string');
}

/** The route's lines inside the box, simplified upstream, in lng/lat. */
export async function routeGeometry(id: number, b: MercatorBox, signal?: AbortSignal): Promise<GeoJSON.FeatureCollection> {
  const res = await fetch(`${WMT_API}/list/segments?bbox=${box(b)}&relations=${id}`, { signal });
  if (!res.ok) throw new Error(`Waymarked Trails HTTP ${res.status}`);
  return toLngLat(await res.json());
}

const reproject = (line: number[][]) => line.map(([x, y]) => fromMercator(x, y));

/** Lines from a 3857 FeatureCollection, reprojected; MapLibre would read the metres as degrees. */
export function toLngLat(fc: { features?: { geometry?: { type?: string; coordinates?: unknown } }[] }): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const f of fc?.features ?? []) {
    const g = f?.geometry;
    if (g?.type === 'LineString') {
      features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: reproject(g.coordinates as number[][]) } });
    } else if (g?.type === 'MultiLineString') {
      features.push({ type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: (g.coordinates as number[][][]).map(reproject) } });
    }
  }
  return { type: 'FeatureCollection', features };
}

/**
 * Whether the overlay draws a route of this group at a map zoom, so a click
 * never names a trail that is not on screen. The 256 px tiles load one zoom
 * deeper than the map; the bands are Waymarked's own, eased down by one.
 */
export function drawnAt(group: string, zoom: number): boolean {
  if (group === 'INT' || group === 'NAT') return true;
  if (group === 'REG' || group.startsWith('AL')) return zoom >= 7;
  return zoom >= 10;
}

const GROUPS: Record<string, { label: string; color: string }> = {
  INT: { label: 'International', color: '#FF5A5A' },
  NAT: { label: 'National', color: '#6F86FF' },
  REG: { label: 'Regional', color: '#FFA304' },
  LOC: { label: 'Local', color: '#B57CF2' },
  AL1: { label: 'Hiking trail', color: '#FFD54F' },
  AL2: { label: 'Mountain trail', color: '#FF5A5A' },
  AL3: { label: 'Demanding mountain trail', color: '#FF5A5A' },
  AL4: { label: 'Alpine trail', color: '#6FA8FF' },
};

export function routeGroup(group: string | undefined): { label: string; color: string } {
  return GROUPS[group ?? ''] ?? { label: group || 'Route', color: GROUPS.LOC.color };
}

export function routeTitle(r: Pick<RouteSummary, 'id' | 'name' | 'ref' | 'itinerary'>): string {
  return r.name || r.ref || r.itinerary?.join(' – ') || `Route ${r.id}`;
}
