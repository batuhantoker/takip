/*
 * The Earth as a geostationary satellite sees it: a near-side perspective from 35,786 km above its
 * sub-satellite point, drawn from imagery in plain latitude and longitude (a WMS GetMap in EPSG:4326).
 */

const R = 6378.137;
/** From the Earth's centre, km. */
const H = 42_164;
const TAN = R / Math.sqrt(H * H - R * R);
const DEG = Math.PI / 180;

/** [lon, lat] seen at (x, y), each -1 to 1 across the Earth's disc with y up; null off the Earth. */
export function diskPoint(x: number, y: number, lon0: number): [number, number] | null {
  if (x * x + y * y > 1) return null;
  const dy = x * TAN;
  const dz = y * TAN;
  const dd = 1 + dy * dy + dz * dz;
  const disc = H * H - dd * (H * H - R * R);
  if (disc < 0) return null;
  const t = (H - Math.sqrt(disc)) / dd;
  const lon = lon0 + Math.atan2(t * dy, H - t) / DEG;
  return [((lon + 540) % 360) - 180, Math.asin(Math.min(1, Math.max(-1, (t * dz) / R))) / DEG];
}

/** Interleaved pixels covering a lat/lon box. */
export interface Equirect {
  data: Uint8Array;
  width: number;
  height: number;
  channels: number;
  west: number;
  east: number;
  south: number;
  north: number;
}

/**
 * The disc centred on `lon0` as size × size RGB, the Earth filling `fill` of the width; black around it and
 * wherever the source has no pixel.
 */
export function drawDisk(src: Equirect, lon0: number, size: number, fill = 0.96): Uint8Array {
  const out = new Uint8Array(size * size * 3);
  const half = size / 2;
  const r = half * fill;
  const sw = src.width / (src.east - src.west);
  const sh = src.height / (src.north - src.south);
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const p = diskPoint((col + 0.5 - half) / r, (half - row - 0.5) / r, lon0);
      if (!p) continue;
      const sx = Math.floor((p[0] - src.west) * sw);
      const sy = Math.floor((src.north - p[1]) * sh);
      if (sx < 0 || sy < 0 || sx >= src.width || sy >= src.height) continue;
      const i = (sy * src.width + sx) * src.channels;
      const o = (row * size + col) * 3;
      out[o] = src.data[i];
      out[o + 1] = src.data[i + 1];
      out[o + 2] = src.data[i + 2];
    }
  }
  return out;
}
