/** [lng, lat] vertices; a closing vertex equal to the first is allowed. */
export type Ring = [number, number][];

export interface LatLng {
  lat: number;
  lng: number;
}

function open(ring: Ring): Ring {
  const [first, last] = [ring[0], ring[ring.length - 1]];
  return ring.length > 1 && first[0] === last[0] && first[1] === last[1] ? ring.slice(0, -1) : ring;
}

/** Planar shoelace area in degrees², only for comparing rings with each other. */
export function ringArea(ring: Ring): number {
  const r = open(ring);
  let twice = 0;
  for (let i = 0; i < r.length; i++) {
    const [x1, y1] = r[i];
    const [x2, y2] = r[(i + 1) % r.length];
    twice += x1 * y2 - x2 * y1;
  }
  return Math.abs(twice) / 2;
}

/** Vertex average, the same representative point the NWS alerts use. */
export function ringCentre(ring: Ring): LatLng | null {
  const r = open(ring).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (!r.length) return null;
  const lng = r.reduce((s, p) => s + p[0], 0) / r.length;
  const lat = r.reduce((s, p) => s + p[1], 0) / r.length;
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

/** Centre of the largest ring: one alert may cover several disjoint areas, and their average can land in none of them. */
export function centreOfLargest(rings: Ring[]): LatLng | null {
  let best: Ring | null = null;
  let bestArea = -1;
  for (const ring of rings) {
    if (ring.length < 3) continue;
    const a = ringArea(ring);
    if (a > bestArea) [best, bestArea] = [ring, a];
  }
  return best ? ringCentre(best) : null;
}
