/**
 * NDW's travel-time sites with road-following geometry, built by tools/traffic/build-ndw.ts.
 * The v3 site table only has start and end points for most sites; the Meetvakken shapefile
 * follows the road, runs in the direction of travel, and joins on the site id.
 */

export const NDW_SITES_PATH = 'data/traffic/ndw-sites.json';

/** Lng/lat are stored as integers at this scale: about a metre. */
const SCALE = 1e5;

export interface NdwSitesFile {
  /** The shapefile's Version.txt, and when the file was built. */
  version: string;
  built: string;
  /** [site id, name, length in metres, line]; the line's first pair is absolute, the rest are deltas. */
  sites: [string, string, number, number[]][];
}

export interface NdwSite {
  name: string;
  lengthM: number;
  coords: [number, number][];
}

export function encodeLine(coords: [number, number][]): number[] {
  const out: number[] = [];
  let px = 0, py = 0;
  for (const [lng, lat] of coords) {
    const x = Math.round(lng * SCALE), y = Math.round(lat * SCALE);
    out.push(x - px, y - py);
    px = x;
    py = y;
  }
  return out;
}

export function decodeLine(flat: number[]): [number, number][] {
  const out: [number, number][] = [];
  let x = 0, y = 0;
  for (let i = 0; i + 1 < flat.length; i += 2) {
    x += flat[i];
    y += flat[i + 1];
    out.push([x / SCALE, y / SCALE]);
  }
  return out;
}

const M_PER_DEG = 111_320;

export function lineLengthM(coords: [number, number][]): number {
  let m = 0;
  for (let i = 1; i < coords.length; i++) {
    const [x0, y0] = coords[i - 1], [x1, y1] = coords[i];
    const k = Math.cos(((y0 + y1) / 2) * (Math.PI / 180));
    m += Math.hypot((x1 - x0) * k, y1 - y0) * M_PER_DEG;
  }
  return m;
}

/** Douglas–Peucker in local metres; the ends always stay. */
export function simplifyLine(coords: [number, number][], toleranceM: number): [number, number][] {
  if (coords.length <= 2) return coords;
  const k = Math.cos(coords[0][1] * (Math.PI / 180)) * M_PER_DEG;
  const xy = coords.map(([x, y]) => [x * k, y * M_PER_DEG] as const);
  const keep = new Uint8Array(coords.length);
  keep[0] = keep[coords.length - 1] = 1;
  const stack: [number, number][] = [[0, coords.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = xy[a], [bx, by] = xy[b];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    let worst = -1, worstD = toleranceM;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = xy[i];
      const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (d > worstD) { worst = i; worstD = d; }
    }
    if (worst > 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  return coords.filter((_, i) => keep[i]);
}

export function readNdwSites(file: NdwSitesFile): Map<string, NdwSite> {
  return new Map(file.sites.map(([id, name, lengthM, line]) => [id, { name, lengthM, coords: decodeLine(line) }]));
}
