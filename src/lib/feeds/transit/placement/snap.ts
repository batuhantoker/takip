/** Moving a tracked vehicle along its route's shape instead of straight across the blocks between fixes. */

export type LngLat = [number, number];

export interface OnShape {
  /** Segment index: between shape[seg] and shape[seg + 1]. */
  seg: number;
  /** How far along that segment, 0–1. */
  t: number;
  at: LngLat;
  /** Metres from the fix to the shape. */
  off: number;
}

const M_PER_DEG = 111_320;

/** Metres between two points; flat-earth is exact enough over a city block. */
export function metres(a: LngLat, b: LngLat): number {
  const cos = Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180));
  return Math.hypot((b[0] - a[0]) * cos, b[1] - a[1]) * M_PER_DEG;
}

export const pathLength = (path: LngLat[]) => path.slice(1).reduce((sum, p, i) => sum + metres(path[i], p), 0);

/** The nearest point on the shape to `p`, searching segments from `from` on. */
export function project(shape: LngLat[], p: LngLat, from = 0): OnShape | null {
  let best: OnShape | null = null;
  const cos = Math.cos(p[1] * (Math.PI / 180));
  for (let i = Math.max(0, from); i < shape.length - 1; i++) {
    const [ax, ay] = shape[i], [bx, by] = shape[i + 1];
    const dx = (bx - ax) * cos, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.min(1, Math.max(0, (((p[0] - ax) * cos) * dx + (p[1] - ay) * dy) / len2)) : 0;
    const at: LngLat = [ax + (bx - ax) * t, ay + (by - ay) * t];
    const off = metres(p, at);
    if (!best || off < best.off) best = { seg: i, t, at, off };
  }
  return best;
}

/** Fixes further than this from the shape are off route (a detour, a depot run): no snapping. */
export const MAX_OFF_M = 60;

/**
 * The stretch of shape from one fix to the next, both snapped onto it, or null when the fixes
 * don't sit on it in order. `from` is where the previous fix was, so a loop route's second pass
 * past the same corner is not mistaken for the first.
 */
export function alongShape(shape: LngLat[], a: LngLat, b: LngLat, from?: OnShape | null): { path: LngLat[]; end: OnShape } | null {
  if (shape.length < 2) return null;
  const pa = from && metres(from.at, a) < 1 ? from : project(shape, a, Math.max(0, (from?.seg ?? 0) - 2));
  if (!pa || pa.off > MAX_OFF_M) return null;
  const pb = project(shape, b, pa.seg);
  if (!pb || pb.off > MAX_OFF_M) return null;
  // Backwards along the shape: GPS jitter at a stop, or a different trip. Hold, don't retrace.
  if (pb.seg === pa.seg && pb.t < pa.t) return { path: [pa.at, pa.at], end: pa };
  const path: LngLat[] = [pa.at, ...shape.slice(pa.seg + 1, pb.seg + 1), pb.at];
  // A stretch far longer than the hop means the snap jumped to another part of the route.
  if (pathLength(path) > 3 * metres(a, b) + 300) return null;
  return { path, end: pb };
}

/** The point `share` (0–1) of the way along a path, and the heading there in degrees. */
export function pointAlong(path: LngLat[], share: number): { at: LngLat; bearing: number | null } {
  const total = pathLength(path);
  let left = Math.min(1, Math.max(0, share)) * total;
  for (let i = 0; i < path.length - 1; i++) {
    const d = metres(path[i], path[i + 1]);
    if (d > 0 && (left <= d || i === path.length - 2)) {
      const t = Math.min(1, left / d);
      const [ax, ay] = path[i], [bx, by] = path[i + 1];
      return { at: [ax + (bx - ax) * t, ay + (by - ay) * t], bearing: bearingOf(path[i], path[i + 1]) };
    }
    left -= d;
  }
  return { at: path[path.length - 1], bearing: null };
}

export function bearingOf(a: LngLat, b: LngLat): number {
  const cos = Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180));
  return ((Math.atan2((b[0] - a[0]) * cos, b[1] - a[1]) * 180) / Math.PI + 360) % 360;
}
