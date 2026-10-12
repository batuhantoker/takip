/*
 * Simplification for the coarser LODs (replay-database.md §8.3). SED, the synchronized Euclidean
 * distance, measures each dropped point against where interpolation would put the object at that
 * point's time, so replay timing stays right, not only the path's shape.
 */

export type TimedPoint = { t: number; lon: number; lat: number; speed?: number };

const M_PER_DEG_LAT = 110_540;
const M_PER_DEG_LON = 111_320;

/** Metres, equirectangular: accurate at these tolerances, and runs never cross the antimeridian. */
export function distanceM(a: { lon: number; lat: number }, b: { lon: number; lat: number }) {
  const dx = (b.lon - a.lon) * M_PER_DEG_LON * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const dy = (b.lat - a.lat) * M_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

function sed(p: TimedPoint, a: TimedPoint, b: TimedPoint) {
  const r = b.t === a.t ? 0 : (p.t - a.t) / (b.t - a.t);
  return distanceM(p, { lon: a.lon + r * (b.lon - a.lon), lat: a.lat + r * (b.lat - a.lat) });
}

/** At most one point per `minIntervalS`; the first and last always stay. */
export function thin<P extends TimedPoint>(points: P[], minIntervalS: number): P[] {
  if (minIntervalS <= 0 || points.length < 3) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    if (points[i].t - out[out.length - 1].t >= minIntervalS) out.push(points[i]);
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Douglas–Peucker on SED, iterative so long tracks can't overflow the stack. Returns the kept indices. */
export function sedKeep(points: TimedPoint[], toleranceM: number): boolean[] {
  const keep = points.map((_, i) => i === 0 || i === points.length - 1);
  const stack: [number, number][] = points.length > 2 ? [[0, points.length - 1]] : [];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    let worst = -1;
    let at = -1;
    for (let k = i + 1; k < j; k++) {
      const d = sed(points[k], points[i], points[j]);
      if (d > worst) {
        worst = d;
        at = k;
      }
    }
    if (worst > toleranceM) {
      keep[at] = true;
      stack.push([i, at], [at, j]);
    }
  }
  return keep;
}

/** While the object moves, adds back original points so no kept gap exceeds `maxIntervalS`. */
export function enforceMaxInterval(points: TimedPoint[], keep: boolean[], maxIntervalS: number, toleranceM: number) {
  if (maxIntervalS <= 0) return keep;
  let a = 0;
  for (let b = 1; b < points.length; b++) {
    if (!keep[b]) continue;
    const moved = distanceM(points[a], points[b]) > toleranceM || points.slice(a, b + 1).some(p => (p.speed ?? 0) > 1);
    if (moved && points[b].t - points[a].t > maxIntervalS) {
      // Greedy: whenever the next point would be too far from the last kept one, keep the point before it.
      let last = a;
      for (let k = a + 1; k <= b; k++) {
        if (points[k].t - points[last].t > maxIntervalS && k - 1 > last) {
          keep[k - 1] = true;
          last = k - 1;
        }
      }
    }
    a = b;
  }
  return keep;
}

export function simplify<P extends TimedPoint>(points: P[], { sedM, minIntervalS, maxIntervalS }: { sedM: number; minIntervalS: number; maxIntervalS: number }): P[] {
  const thinned = thin(points, minIntervalS);
  if (sedM <= 0) return thinned;
  const keep = enforceMaxInterval(thinned, sedKeep(thinned, sedM), maxIntervalS, sedM);
  return thinned.filter((_, i) => keep[i]);
}
