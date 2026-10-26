import { haversine } from '@/lib/core/geodesic';

/**
 * Day plans through the best-known things to do: a day starts at the best known place left and takes the best known
 * of those near it, up to DAY_STOPS, then walks them in the shortest order. Straight lines between stops, not streets.
 */

export interface PlanPoint { id: string; at: readonly [number, number]; l: number }
export interface PlanDay<P extends PlanPoint = PlanPoint> { stops: P[]; km: number }

export const DAY_STOPS = 6;
export const MIN_STOPS = 3;
/** A stop is at most this far from one already in its day. */
const NEXT_KM = 1.5;
/** And this far from where the day starts, so a chain of neighbours can't wander across a city. */
const SPREAD_KM = 3;
/** A place this well known fills a day of its own, as Versailles does. */
const WHOLE_DAY_LINKS = 60;

export const kmBetween = (a: PlanPoint, b: PlanPoint) => haversine([a.at[0], a.at[1]], [b.at[0], b.at[1]]);

const pathKm = (path: readonly PlanPoint[]) => path.slice(1).reduce((km, p, i) => km + kmBetween(path[i], p), 0);

function permutations<T>(list: T[]): T[][] {
  if (list.length <= 1) return [list];
  return list.flatMap((x, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map(rest => [x, ...rest]));
}

/** The shortest walk through `points` from any of them, or from the first with `fromFirst`; exact up to eight. */
export function shortestPath<P extends PlanPoint>(points: readonly P[], fromFirst = false): P[] {
  if (!fromFirst && points.length > 1 && points.length <= 8) {
    return points.map((_, i) => shortestPath([points[i], ...points.filter((_, j) => j !== i)], true))
      .reduce((best, path) => (pathKm(path) < pathKm(best) - 1e-9 ? path : best));
  }
  const [first, ...rest] = points;
  if (!first) return [];
  if (rest.length <= 7) {
    let best: P[] = [first, ...rest];
    let bestKm = pathKm(best);
    for (const order of permutations(rest)) {
      const km = pathKm([first, ...order]);
      if (km < bestKm - 1e-9) [best, bestKm] = [[first, ...order], km];
    }
    return best;
  }
  const path = [first];
  const left = [...rest];
  while (left.length) {
    const last = path[path.length - 1];
    let k = 0;
    for (let i = 1; i < left.length; i++) if (kmBetween(last, left[i]) < kmBetween(last, left[k])) k = i;
    path.push(...left.splice(k, 1));
  }
  return path;
}

/** One day from `pool` (best known first): its stops in walking order, or null when too few are close together. */
export function planDay<P extends PlanPoint>(pool: readonly P[]): PlanDay<P> | null {
  const [start, ...rest] = pool;
  if (!start) return null;
  const chosen = [start];
  for (const p of rest) {
    if (chosen.length >= DAY_STOPS) break;
    if (kmBetween(start, p) <= SPREAD_KM && chosen.some(c => kmBetween(c, p) <= NEXT_KM)) chosen.push(p);
  }
  if (chosen.length < MIN_STOPS && start.l < WHOLE_DAY_LINKS) return null;
  const stops = shortestPath(chosen);
  return { stops, km: pathKm(stops) };
}

/** Up to `days` days from `pool`, each from what the ones before left; a place that starts no day is passed over. */
export function planDays<P extends PlanPoint>(pool: readonly P[], days: number): PlanDay<P>[] {
  const out: PlanDay<P>[] = [];
  let left = [...pool];
  while (left.length && out.length < days) {
    const day = planDay(left);
    const used = new Set(day ? day.stops.map(s => s.id) : [left[0].id]);
    if (day) out.push(day);
    left = left.filter(p => !used.has(p.id));
  }
  return out;
}
