/** Distances, framing and "is it in view" for TI's queries. Pure. */

export interface Point { lat: number; lng: number }
export interface Bounds { west: number; south: number; east: number; north: number }
/** A place the geocoder found, with what kind of place it is. */
export interface Place { name: string; lat: number; lng: number; kind?: string }

/** Great-circle distance in km. */
export function km(a: Point, b: Point): number {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A camera that shows every point: their middle, and a zoom wide enough for the spread. */
export function frame(points: Point[], fallbackZoom = 9): { lat: number; lng: number; zoom: number } | null {
  const ps = points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (!ps.length) return null;
  if (ps.length === 1) return { lat: ps[0].lat, lng: ps[0].lng, zoom: fallbackZoom };
  const lats = ps.map(p => p.lat), lngs = ps.map(p => p.lng);
  let west = Math.min(...lngs), east = Math.max(...lngs);
  // Points either side of the antimeridian sit closer across it.
  const shifted = lngs.map(l => (l < 0 ? l + 360 : l));
  if (Math.max(...shifted) - Math.min(...shifted) < east - west) { west = Math.min(...shifted); east = Math.max(...shifted); }
  const south = Math.min(...lats), north = Math.max(...lats);
  const span = Math.max(east - west, (north - south) * 1.6, 0.02);
  const zoom = Math.max(1.6, Math.min(12, Math.log2(360 / span) - 0.2));
  let lng = (west + east) / 2;
  if (lng > 180) lng -= 360;
  return { lat: (south + north) / 2, lng, zoom: Math.round(zoom * 10) / 10 };
}

/** The zoom that shows a circle of this radius. */
export const zoomForRadius = (radiusKm: number, lo = 2, hi = 11) => Math.round(Math.max(lo, Math.min(hi, Math.log2(40_000 / Math.max(5, radiusKm * 2.4)))) * 10) / 10;

const wrap = (x: number) => ((((x + 180) % 360) + 360) % 360) - 180;

/** Whether a point is in the view, including a view that crosses the antimeridian or wraps the world. */
export function inBounds(p: Point, b: Bounds): boolean {
  if (p.lat < b.south || p.lat > b.north) return false;
  if (b.east - b.west >= 360) return true;
  const w = wrap(b.west), e = wrap(b.east), x = wrap(p.lng);
  return w <= e ? x >= w && x <= e : x >= w || x <= e;
}

function inRing(ring: number[][], lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Whether a point is inside a polygon or multipolygon, holes excluded. */
export function inPolygon(p: Point, g: GeoJSON.Polygon | GeoJSON.MultiPolygon): boolean {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const x = wrap(p.lng);
  return polys.some(rings => rings.length > 0 && inRing(rings[0], x, p.lat) && !rings.slice(1).some(h => inRing(h, x, p.lat)));
}

/** Points along the great circle from a to b, for drawing it. */
export function greatCircle(a: Point, b: Point, steps = 64): [number, number][] {
  const r = Math.PI / 180;
  const φ1 = a.lat * r, λ1 = a.lng * r, φ2 = b.lat * r, λ2 = b.lng * r;
  const d = km(a, b) / 6371;
  if (d < 1e-6) return [[a.lng, a.lat], [b.lng, b.lat]];
  const out: [number, number][] = [];
  let prev: number | null = null;
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    let lng = Math.atan2(y, x) / r;
    // Keep the line continuous across the antimeridian, as MapLibre draws it.
    if (prev !== null) while (Math.abs(lng - prev) > 180) lng += lng < prev ? 360 : -360;
    prev = lng;
    out.push([lng, Math.atan2(z, Math.sqrt(x * x + y * y)) / r]);
  }
  return out;
}
