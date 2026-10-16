import { MAX_GAP_DAYS, MAX_GAP_YEARS, type ShapePoint, type Step } from '@/lib/history/series';

/*
 * The country chart's geometry, kept apart from React so it can be tested: where a point sits in time,
 * the value axis, and the runs of points a line joins. It joins exactly what the map interpolates between
 * (readingAt), so a gap in a line is a stretch the map hatches as no data.
 */

/** A yearly value counts from mid-year (readingAt), so it is drawn there; a dated point at its date. */
export const timeOf = (x: number, step: Step = 'year') => (step === 'day' ? x : x + 0.5);

export type ValueAxis = { lo: number; hi: number; log: boolean; ticks: number[]; norm(v: number): number };

function niceStep(span: number, count: number) {
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
}

/**
 * Round ends and three or four ticks around the charted values. `log` (the map's log1p scale for heavy-tailed
 * metrics) ticks at powers of ten from 0, so a chart of GDP or deaths reads like the map's colours.
 */
export function valueAxis(values: readonly number[], log = false): ValueAxis | null {
  if (!values.length) return null;
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (log && min >= 0) {
    const top = 10 ** Math.ceil(Math.log10(Math.max(1, max)));
    const bottom = min < 1 ? 0 : 10 ** Math.floor(Math.log10(min));
    const ticks = [bottom];
    for (let t = Math.max(1, bottom * 10); t <= top; t *= 10) ticks.push(t);
    // A dozen decades is too many labels; keep every other one, ends included.
    const shown = ticks.length > 6 ? ticks.filter((_, i) => i % 2 === (ticks.length - 1) % 2) : ticks;
    const f0 = Math.log1p(bottom);
    const f1 = Math.log1p(top);
    return { lo: bottom, hi: top, log: true, ticks: shown, norm: v => (Math.log1p(Math.max(0, v)) - f0) / (f1 - f0) };
  }
  if (min === max) {
    const pad = Math.abs(min) || 1;
    min -= pad;
    max += pad;
  }
  const step = niceStep(max - min, 3);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Number(t.toPrecision(12)));
  return { lo, hi, log: false, ticks, norm: v => (v - lo) / (hi - lo) };
}

export type Run = { points: [number, number][]; projected: boolean };

/** Consecutive points the map would join: split at a gap readingAt won't bridge, and where projections begin. */
export function runsOf(points: readonly ShapePoint[], step: Step = 'year', projectedFrom?: number): Run[] {
  const gap = step === 'day' ? MAX_GAP_DAYS / 365.25 : MAX_GAP_YEARS;
  const runs: Run[] = [];
  let run: Run | null = null;
  let prev: number | null = null;
  for (const [x, v] of points) {
    const projected = projectedFrom !== undefined && x >= projectedFrom;
    if (!run || prev === null || x - prev > gap || projected !== run.projected) {
      run = { points: [], projected };
      runs.push(run);
    }
    run.points.push([timeOf(x, step), v]);
    prev = x;
  }
  return runs;
}

/** Up to five round years across [from, to]: the ends and the decades, centuries or millennia between. */
export function timeTicks(from: number, to: number): number[] {
  const span = to - from;
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000].find(s => span / s <= 5) ?? 10_000;
  const ticks: number[] = [];
  for (let t = Math.ceil(from / step) * step; t <= to; t += step) ticks.push(t);
  return ticks;
}

/** Which labels fit: walking down the chart by y, each keeps its place unless it would sit on the last one kept. */
export function labelsThatFit<T extends { y: number }>(heads: readonly T[], height = 12): T[] {
  const kept: T[] = [];
  for (const h of [...heads].sort((a, b) => a.y - b.y)) {
    if (!kept.length || h.y - kept[kept.length - 1].y >= height) kept.push(h);
  }
  return kept;
}

export type Range = [number, number];

/** The time a set of series covers: the first point to the end of the last one's year (its date, if dated). */
export function extentOf(series: readonly (readonly ShapePoint[])[], step: Step = 'year'): Range | null {
  const filled = series.filter(s => s.length);
  if (!filled.length) return null;
  const t0 = Math.min(...filled.map(s => s[0][0]));
  const t1 = Math.max(...filled.map(s => s[s.length - 1][0]));
  return [t0, t1 + (step === 'day' ? 0 : 1)];
}

/** The values a view of [t0, t1] needs on its axis: the points inside, and the nearest each side, which its lines run to. */
export function visibleValues(points: readonly ShapePoint[], step: Step, [t0, t1]: Range): number[] {
  const out: number[] = [];
  points.forEach(([x, v], i) => {
    const t = timeOf(x, step);
    const next = points[i + 1] && timeOf(points[i + 1][0], step);
    const prev = i > 0 ? timeOf(points[i - 1][0], step) : undefined;
    if ((t >= t0 && t <= t1) || (t < t0 && next !== undefined && next >= t0) || (t > t1 && prev !== undefined && prev <= t1)) out.push(v);
  });
  return out;
}

/** The view scaled by `factor` about `at`, which stays under the pointer. */
export function zoomAround([t0, t1]: Range, at: number, factor: number): Range {
  return [at - (at - t0) * factor, at + (t1 - at) * factor];
}

/** A view kept inside `full` and at least `minSpan` wide; null once it covers all of `full`. */
export function clampRange([a, b]: Range, [lo, hi]: Range, minSpan: number): Range | null {
  if (b < a) [a, b] = [b, a];
  const span = Math.max(minSpan, b - a);
  if (span >= hi - lo) return null;
  const mid = (a + b) / 2;
  if (b - a < minSpan) [a, b] = [mid - span / 2, mid + span / 2];
  if (a < lo) [a, b] = [lo, lo + span];
  if (b > hi) [a, b] = [hi - span, hi];
  return [a, b];
}
