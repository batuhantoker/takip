/* Web Mercator tile maths for tile-addressed replay requests. */

export const MAX_LAT = 85.0511287798066;

export type Bbox = { w: number; s: number; e: number; n: number };

const latOfRow = (y: number, z: number) => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
};

/** Degrees covered by a tile. The top and bottom rows reach the poles, so polar tracks still land in a tile. */
export function tileBbox(z: number, x: number, y: number): Bbox {
  const size = 2 ** z;
  return {
    w: (x / size) * 360 - 180,
    e: ((x + 1) / size) * 360 - 180,
    n: y === 0 ? 90 : latOfRow(y, z),
    s: y === size - 1 ? -90 : latOfRow(y + 1, z),
  };
}

export function lonLatToTile(lon: number, lat: number, z: number): { x: number; y: number } {
  const size = 2 ** z;
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const rad = (clamped * Math.PI) / 180;
  const x = Math.floor(((lon + 180) / 360) * size);
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * size);
  return { x: Math.min(size - 1, Math.max(0, x)), y: Math.min(size - 1, Math.max(0, y)) };
}

export const isTile = (z: number, x: number, y: number) =>
  Number.isInteger(z) && Number.isInteger(x) && Number.isInteger(y) && z >= 0 && z <= 24 && x >= 0 && y >= 0 && x < 2 ** z && y < 2 ** z;

/** Every tile at zoom `z` a bbox touches. */
export function tilesForBbox(b: Bbox, z: number): { x: number; y: number }[] {
  const a = lonLatToTile(b.w, b.n, z);
  const c = lonLatToTile(b.e, b.s, z);
  const out: { x: number; y: number }[] = [];
  for (let x = a.x; x <= c.x; x++) for (let y = a.y; y <= c.y; y++) out.push({ x, y });
  return out;
}
