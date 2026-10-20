import type { Yearly } from '@/lib/platform/site/places/topics/indicators-data';

/**
 * The geometry of the indicator charts, in a 1000 × 1000 box the SVG stretches to its frame: the years and
 * values each chart spans, its ticks, and its lines as path data. Points more than MAX_GAP years apart aren't
 * joined, as on History's map, so a sparse series shows as the dots it is.
 */

export const BOX = 1000;
export const MAX_GAP = 10;

export type Domain = { x: [number, number]; y: [number, number] };

export const points = ([from, values]: Yearly): [number, number][] =>
  values.flatMap((v, i) => (v === null ? [] : [[from + i, v] as [number, number]]));

/** The years and values every series spans, the value range opened to include zero where it is close. */
export function domainOf(series: (Yearly | undefined)[]): Domain | null {
  const all = series.flatMap(s => (s ? points(s) : []));
  if (!all.length) return null;
  const xs = all.map(p => p[0]);
  const ys = all.map(p => p[1]);
  let lo = Math.min(...ys);
  let hi = Math.max(...ys);
  // A series that stays above zero reads truest from zero, unless that flattens it to a line.
  if (lo > 0 && lo < hi * 0.4) lo = 0;
  if (lo === hi) {
    const pad = Math.abs(lo) * 0.1 || 1;
    lo -= pad;
    hi += pad;
  }
  return { x: [Math.min(...xs), Math.max(...xs)], y: [lo, hi] };
}

/** Round steps of 1, 2, 2.5 or 5 × 10ⁿ, about `count` of them, covering [lo, hi]. */
export function niceTicks(lo: number, hi: number, count = 4): number[] {
  const span = hi - lo || Math.abs(hi) || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw)!;
  const first = Math.floor(lo / step) * step;
  const out: number[] = [];
  for (let v = first; v <= hi + step * 1e-9; v += step) out.push(Number(v.toPrecision(12)));
  if (out[out.length - 1] < hi) out.push(Number((out[out.length - 1] + step).toPrecision(12)));
  return out;
}

/** Years to label: round decades or centuries, about `count` of them, inside the span. */
export function yearTicks(from: number, to: number, count = 5): number[] {
  const span = Math.max(1, to - from);
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find(s => span / s <= count) ?? 1000;
  const out: number[] = [];
  for (let y = Math.ceil(from / step) * step; y <= to; y += step) out.push(y);
  return out;
}

export function scales(d: Domain) {
  const [x0, x1] = d.x;
  const [y0, y1] = d.y;
  return {
    x: (year: number) => (x1 === x0 ? BOX / 2 : ((year - x0) / (x1 - x0)) * BOX),
    y: (v: number) => BOX - ((v - y0) / (y1 - y0)) * BOX,
  };
}

const fmt = (n: number) => String(Math.round(n * 10) / 10);

/** A line through the points, broken across gaps; a lone point is a zero-length segment the round cap draws as a dot. */
export function linePath(pts: [number, number][], s: ReturnType<typeof scales>): string {
  let d = '';
  let prev: number | null = null;
  for (const [year, v] of pts) {
    const cmd = prev !== null && year - prev <= MAX_GAP ? 'L' : 'M';
    d += `${cmd}${fmt(s.x(year))} ${fmt(s.y(v))}`;
    if (cmd === 'M') d += 'l0 0';
    prev = year;
  }
  return d;
}

/** The band between two series, over the years both have, as closed shapes broken where either has a gap. */
export function bandPath(lo: Yearly, hi: Yearly, s: ReturnType<typeof scales>): string {
  const upper = new Map(points(hi));
  const both = points(lo).filter(([y]) => upper.has(y));
  const runs: [number, number, number][][] = [];
  for (const [y, l] of both) {
    const run = runs[runs.length - 1];
    if (run && y - run[run.length - 1][0] <= MAX_GAP) run.push([y, l, upper.get(y)!]);
    else runs.push([[y, l, upper.get(y)!]]);
  }
  return runs.filter(r => r.length > 1).map(r => {
    const top = r.map(([y, , h]) => `${fmt(s.x(y))} ${fmt(s.y(h))}`);
    const bottom = r.slice().reverse().map(([y, l]) => `${fmt(s.x(y))} ${fmt(s.y(l))}`);
    return `M${top.join('L')}L${bottom.join('L')}Z`;
  }).join('');
}

/** As a share of the box, for placing HTML over the chart. */
export const pct = (n: number) => `${((n / BOX) * 100).toFixed(2)}%`;
