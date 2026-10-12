/** [west, south, east, north] in degrees, with west <= east, inside ±180 / ±90. */
export type Box = [number, number, number, number];

export const WORLD: Box = [-180, -90, 180, 90];

/**
 * Parses "west,south,east,north" into one box, or two when it crosses the
 * antimeridian. Longitudes may be unwrapped (MapLibre reports east = 190 for a
 * view across ±180), and west > east also means crossing. Null if malformed.
 */
export function parseBbox(raw: string): Box[] | null {
  const parts = raw.split(',').map(s => Number(s.trim()));
  if (parts.length !== 4 || parts.some(n => !Number.isFinite(n))) return null;
  let [west, south, east, north] = parts;
  south = Math.max(-90, south);
  north = Math.min(90, north);
  if (south >= north) return null;
  if (west > east) east += 360;
  if (east - west >= 360) return [[-180, south, 180, north]];
  const shift = Math.floor((west + 180) / 360) * 360;
  west -= shift;
  east -= shift;
  if (east <= 180) return [[west, south, east, north]];
  return [[west, south, 180, north], [-180, south, east - 360, north]];
}

/** Whether the bbox stored at `bboxes[4i..4i+3]` touches any of `boxes`. */
export function intersectsAny(bboxes: Float64Array, i: number, boxes: readonly Box[]): boolean {
  const w = bboxes[4 * i], s = bboxes[4 * i + 1], e = bboxes[4 * i + 2], n = bboxes[4 * i + 3];
  for (const b of boxes) {
    if (w <= b[2] && e >= b[0] && s <= b[3] && n >= b[1]) return true;
  }
  return false;
}
