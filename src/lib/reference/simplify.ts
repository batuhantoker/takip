type Point = number[];

const EARTH_CIRCUMFERENCE_M = 40_075_016.686;

/** Ground metres per screen pixel at the equator for MapLibre's 512 px tiles. */
export function metresPerPixel(zoom: number): number {
  return EARTH_CIRCUMFERENCE_M / (512 * 2 ** zoom);
}

/** Douglas–Peucker in local metres (longitude scaled by the line's latitude); iterative, so long routes cannot overflow the stack. */
export function simplifyLine(pts: Point[], tolEquatorM: number): Point[] {
  const n = pts.length;
  if (n < 3) return pts;
  let lat = 0;
  for (const p of pts) lat += p[1];
  const cos = Math.cos((lat / n) * Math.PI / 180);
  const kx = cos * 111_320, ky = 110_574;
  const tol = tolEquatorM * cos;
  const tol2 = tol * tol;
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    if (b - a < 2) continue;
    const ax = pts[a][0] * kx, ay = pts[a][1] * ky;
    const dx = pts[b][0] * kx - ax, dy = pts[b][1] * ky - ay;
    const seg2 = dx * dx + dy * dy;
    let best = -1, idx = -1;
    for (let i = a + 1; i < b; i++) {
      let px = pts[i][0] * kx - ax, py = pts[i][1] * ky - ay;
      if (seg2) {
        const t = Math.max(0, Math.min(1, (px * dx + py * dy) / seg2));
        px -= t * dx;
        py -= t * dy;
      }
      const d = px * px + py * py;
      if (d > best) {
        best = d;
        idx = i;
      }
    }
    if (best > tol2) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

interface LineFeature {
  geometry: { type: string; coordinates: unknown };
}

/** Simplifies a LineString or MultiLineString feature in place; other geometries are left alone. */
export function simplifyLineFeature(feature: LineFeature, tolEquatorM: number): void {
  const g = feature.geometry;
  if (g.type === 'LineString') g.coordinates = simplifyLine(g.coordinates as Point[], tolEquatorM);
  else if (g.type === 'MultiLineString') g.coordinates = (g.coordinates as Point[][]).map(l => simplifyLine(l, tolEquatorM));
}
