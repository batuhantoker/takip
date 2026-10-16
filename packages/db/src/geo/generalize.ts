import type { Bbox } from '@takip/core/tiles';
import { bboxOf, type Geometry, type Position, type Ring, vertexCount } from './geometry';

/** Zoom bands of feature_gen (§8.5). A tile at zoom z reads band zband(z). */
export const ZBANDS = [
  { zb: 0, maxZoom: 2 },
  { zb: 1, maxZoom: 4 },
  { zb: 2, maxZoom: 6 },
  { zb: 3, maxZoom: 9 },
  { zb: 4, maxZoom: 24 },
] as const;

export const zband = (z: number) => ZBANDS.find(b => z <= b.maxZoom)!.zb;

/** About one pixel at the band's deepest zoom, in degrees; the last band keeps full detail. */
export const bandTolerance = (zb: number) => (zb >= ZBANDS.length - 1 ? 0 : 360 / (256 * 2 ** ZBANDS[zb].maxZoom));

export const MAX_PIECE_VERTICES = 256;

function sqSegDist(p: Position, a: Position, b: Position) {
  let [x, y] = a;
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) [x, y] = b;
    else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

/** Douglas–Peucker, iterative so huge rings can't overflow the stack. */
export function simplifyLine(pts: Position[], tol: number): Position[] {
  if (tol <= 0 || pts.length <= 2) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  const sq = tol * tol;
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let max = sq;
    let idx = -1;
    for (let i = first + 1; i < last; i++) {
      const d = sqSegDist(pts[i], pts[first], pts[last]);
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (idx >= 0) {
      keep[idx] = 1;
      stack.push([first, idx], [idx, last]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const ringArea = (r: Ring) => {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
  return Math.abs(a / 2);
};

function simplifyRing(r: Ring, tol: number): Ring | null {
  if (tol <= 0) return r;
  if (ringArea(r) < tol * tol) return null;
  const s = simplifyLine(r, tol);
  return s.length >= 4 ? s : null;
}

function simplifyPolygon(p: Ring[], tol: number): Ring[] | null {
  const outer = simplifyRing(p[0], tol);
  if (!outer) return null;
  return [outer, ...p.slice(1).map(r => simplifyRing(r, tol)).filter((r): r is Ring => !!r)];
}

const boxRing = (b: Bbox): Ring => [[b.w, b.s], [b.e, b.s], [b.e, b.n], [b.w, b.n], [b.w, b.s]];

/** A box per polygon: one round them all would cover the sea between far-flung islands. */
function partBoxes(polys: Ring[][]): Geometry {
  const boxes = polys.map(p => [boxRing(bboxOf({ type: 'Polygon', coordinates: p }))]);
  return boxes.length === 1 ? { type: 'Polygon', coordinates: boxes[0] } : { type: 'MultiPolygon', coordinates: boxes };
}

/**
 * The geometry at a band's tolerance. Features that vanish return null, unless `keepSmall`,
 * which keeps boxes of the original so small polities still get a choropleth cell.
 */
export function simplify(g: Geometry, tol: number, keepSmall = false): Geometry | null {
  if (tol <= 0 || g.type === 'Point') return g;
  switch (g.type) {
    case 'LineString': {
      const c = simplifyLine(g.coordinates, tol);
      return { type: 'LineString', coordinates: c };
    }
    case 'MultiLineString':
      return { type: 'MultiLineString', coordinates: g.coordinates.map(l => simplifyLine(l, tol)) };
    case 'Polygon':
    case 'MultiPolygon': {
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      const out = polys.map(p => simplifyPolygon(p, tol)).filter((p): p is Ring[] => !!p);
      if (!out.length) return keepSmall ? partBoxes(polys) : null;
      return out.length === 1 ? { type: 'Polygon', coordinates: out[0] } : { type: 'MultiPolygon', coordinates: out };
    }
  }
}

/** Sutherland–Hodgman against one axis-aligned edge. */
function clipEdge(r: Position[], inside: (p: Position) => boolean, cross: (a: Position, b: Position) => Position) {
  const out: Position[] = [];
  for (let i = 0; i < r.length; i++) {
    const cur = r[i];
    const prev = r[(i + r.length - 1) % r.length];
    if (inside(cur)) {
      if (!inside(prev)) out.push(cross(prev, cur));
      out.push(cur);
    } else if (inside(prev)) out.push(cross(prev, cur));
  }
  return out;
}

function clipRing(ring: Ring, b: Bbox): Ring | null {
  let r = ring.slice(0, -1);
  const atX = (x: number) => (a: Position, c: Position): Position => [x, a[1] + ((c[1] - a[1]) * (x - a[0])) / (c[0] - a[0])];
  const atY = (y: number) => (a: Position, c: Position): Position => [a[0] + ((c[0] - a[0]) * (y - a[1])) / (c[1] - a[1]), y];
  r = clipEdge(r, p => p[0] >= b.w, atX(b.w));
  r = clipEdge(r, p => p[0] <= b.e, atX(b.e));
  r = clipEdge(r, p => p[1] >= b.s, atY(b.s));
  r = clipEdge(r, p => p[1] <= b.n, atY(b.n));
  if (r.length < 3) return null;
  return [...r, r[0]];
}

/** Clips polygons to a box; lines and points pass through untouched. */
export function clipToBox(g: Geometry, b: Bbox): Geometry | null {
  if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') return g;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const out: Ring[][] = [];
  for (const p of polys) {
    const outer = clipRing(p[0], b);
    if (!outer) continue;
    out.push([outer, ...p.slice(1).map(r => clipRing(r, b)).filter((r): r is Ring => !!r)]);
  }
  if (!out.length) return null;
  return out.length === 1 ? { type: 'Polygon', coordinates: out[0] } : { type: 'MultiPolygon', coordinates: out };
}

/**
 * Splits a geometry into pieces of at most `max` vertices by halving its box, like PostGIS ST_Subdivide,
 * so a tile probe only touches the pieces it needs. Polygons of a multipolygon become separate pieces first.
 */
export function subdivide(g: Geometry, max = MAX_PIECE_VERTICES, depth = 0): Geometry[] {
  if (g.type === 'MultiPolygon' && g.coordinates.length > 1) return g.coordinates.flatMap(p => subdivide({ type: 'Polygon', coordinates: p }, max, depth));
  if (vertexCount(g) <= max || depth > 16 || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) return [g];
  const b = bboxOf(g);
  const wide = b.e - b.w >= b.n - b.s;
  const mid = wide ? (b.w + b.e) / 2 : (b.s + b.n) / 2;
  const halves: Bbox[] = wide ? [{ ...b, e: mid }, { ...b, w: mid }] : [{ ...b, n: mid }, { ...b, s: mid }];
  return halves.flatMap(h => {
    const c = clipToBox(g, h);
    return c ? subdivide(c, max, depth + 1) : [];
  });
}
