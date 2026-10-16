/** EPSG:3857 (web mercator metres), which is what the Waymarked Trails API reads and writes. */

const R = 6378137;
const MAX_LAT = 85.0511287798;
export const WORLD_HALF = Math.PI * R;

/** minX, minY, maxX, maxY in metres. */
export type MercatorBox = [number, number, number, number];

export function toMercator(lng: number, lat: number): [number, number] {
  const phi = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI / 180;
  return [R * lng * Math.PI / 180, R * Math.log(Math.tan(Math.PI / 4 + phi / 2))];
}

export function fromMercator(x: number, y: number): [number, number] {
  return [x / R * 180 / Math.PI, (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI];
}

/** The box around two lng/lat corners, grown by `pad` of its size on each side and kept on the world. */
export function mercatorBox(west: number, south: number, east: number, north: number, pad = 0): MercatorBox {
  const [x1, y1] = toMercator(west, south);
  const [x2, y2] = toMercator(east, north);
  const dx = Math.abs(x2 - x1) * pad;
  const dy = Math.abs(y2 - y1) * pad;
  const clamp = (v: number) => Math.max(-WORLD_HALF, Math.min(WORLD_HALF, v));
  return [clamp(Math.min(x1, x2) - dx), clamp(Math.min(y1, y2) - dy), clamp(Math.max(x1, x2) + dx), clamp(Math.max(y1, y2) + dy)];
}

export function boxContains(outer: MercatorBox, inner: MercatorBox): boolean {
  return outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3];
}
