import type { Measure } from '../types';
import { type Series, daysBetween, logReturns, demean, seriesStats, tradingDays } from './series';

/** A small, fast, seeded generator (mulberry32): the same seed, the same draws. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seed from text, so an instrument always resamples the same way. */
export function seedOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export interface Paths {
  /** Each path's last, highest and lowest price, as a multiple of where it started. */
  final: Float64Array;
  max: Float64Array;
  min: Float64Array;
}

/** `count` paths of `steps` days, each day one of the history's own moves drawn at random. */
export function resample(returns: number[], steps: number, count: number, seed: number): Paths {
  const final = new Float64Array(count), max = new Float64Array(count), min = new Float64Array(count);
  const draw = rng(seed);
  const n = returns.length;
  for (let p = 0; p < count; p++) {
    let x = 0, hi = 0, lo = 0;
    for (let d = 0; d < steps && n; d++) {
      x += returns[Math.floor(draw() * n)];
      if (x > hi) hi = x;
      if (x < lo) lo = x;
    }
    final[p] = Math.exp(x);
    max[p] = Math.exp(hi);
    min[p] = Math.exp(lo);
  }
  return { final, max, min };
}

export const quantile = (sorted: Float64Array | number[], q: number) => {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};

/** Whether a path that started at `price` met the measure's level: touched it, or ended beyond it. */
export function met(m: Measure, price: number, p: Paths, i: number): boolean {
  const level = m.threshold!;
  if (m.direction === 'below') return price * (m.touch ? p.min[i] : p.final[i]) <= level;
  return price * (m.touch ? p.max[i] : p.final[i]) >= level;
}

/** The chance the price trades at a level (touches it) before the horizon. */
export interface CurvePoint { level: number; probability: number }

/** Levels to draw a touch curve at: a geometric grid from a quarter of the price to four times it, and any levels asked for. */
export function curveLevels(price: number, extra: number[] = [], points = 49): number[] {
  const grid = Array.from({ length: points }, (_, i) => (price * Math.pow(16, i / (points - 1))) / 4);
  return [...new Set([...grid, ...extra.filter(l => l > 0 && Number.isFinite(l))].map(l => +l.toPrecision(6)))].sort((a, b) => a - b);
}

/**
 * The touch curve of paths that started at `price` (`max` and `min` are each
 * path's highest and lowest point, as multiples of it): above the price, the
 * share of paths that rose to the level; below it, the share that fell to it.
 */
export function touchCurve(price: number, max: ArrayLike<number>, min: ArrayLike<number>, levels: number[]): CurvePoint[] {
  const n = max.length;
  return levels.map(level => {
    let hits = 0;
    if (level >= price) { for (let i = 0; i < n; i++) if (price * max[i] >= level) hits++; }
    else { for (let i = 0; i < n; i++) if (price * min[i] <= level) hits++; }
    return { level, probability: n ? hits / n : NaN };
  });
}

/** One period of a world's price course, as multiples of the price the world started at. */
export interface CourseStep { close: number; high: number; low: number }

/**
 * A price course for each world, period by period, before any event pushes
 * it: drawn from many resampled paths and spread evenly across them by where
 * they end, so a handful of worlds still spans what can happen. The first
 * world, which follows the likeliest course, takes the middle of the range;
 * the others alternate below and above it.
 */
export function worldCourses(returns: number[], stepsPerPeriod: number[], worlds: number, seed: number, pool = 300): CourseStep[][] {
  const draw = rng(seed);
  const n = returns.length;
  const candidates: CourseStep[][] = [];
  for (let c = 0; c < pool; c++) {
    let x = 0;
    const course: CourseStep[] = [];
    for (const steps of stepsPerPeriod) {
      let hi = x, lo = x;
      for (let d = 0; d < steps && n; d++) {
        x += returns[Math.floor(draw() * n)];
        if (x > hi) hi = x;
        if (x < lo) lo = x;
      }
      course.push({ close: Math.exp(x), high: Math.exp(hi), low: Math.exp(lo) });
    }
    candidates.push(course);
  }
  const last = (c: CourseStep[]) => c[c.length - 1]?.close ?? 1;
  candidates.sort((a, b) => last(a) - last(b));
  // Evenly spaced through the range, then dealt out from the middle: nearest the median first, the lower of a tie first.
  const qs = Array.from({ length: worlds }, (_, w) => (w + 0.5) / worlds)
    .sort((a, b) => Math.abs(a - 0.5) - Math.abs(b - 0.5) || a - b);
  return qs.map(q => candidates[Math.min(pool - 1, Math.floor(q * pool))]);
}

/** Where the price may be at each date: the 10th, 50th and 90th percentile of the resampled paths. */
export interface FanPoint { date: string; p10: number; p50: number; p90: number }

/**
 * The cone of what the market's own moves allow, date by date: from today's
 * price through each of `dates`, the middle and the 80% band of the
 * resampled paths. The worlds' courses are drawn inside it.
 */
export function fanOf(s: Series, today: string, dates: string[], count = 2000): FanPoint[] {
  const stats = seriesStats(s);
  if (!stats || !dates.length) return [];
  const returns = demean(logReturns(s));
  const marks = dates.map(d => tradingDays(daysBetween(today, d), stats.perYear));
  const last = Math.max(...marks);
  const at: number[][] = dates.map(() => []);
  const draw = rng(seedOf(`${s.symbol}:fan`));
  const n = returns.length;
  for (let p = 0; p < count; p++) {
    let x = 0, k = 0;
    for (let d = 1; d <= last && n; d++) {
      x += returns[Math.floor(draw() * n)];
      while (k < marks.length && marks[k] === d) at[k++].push(Math.exp(x));
    }
    while (k < marks.length) at[k++].push(Math.exp(x));
  }
  return dates.map((date, i) => {
    const xs = at[i].sort((a, b) => a - b);
    return { date, p10: stats.price * quantile(xs, 0.1), p50: stats.price * quantile(xs, 0.5), p90: stats.price * quantile(xs, 0.9) };
  });
}

/** What the worlds' events do to a price question once the market's randomness is integrated out. */
export interface Priced {
  /** A level: the share of paths that meet it. */
  probability?: number;
  /** The price at the horizon, across every world's paths. */
  p10: number;
  p50: number;
  p90: number;
  /** The chance of trading at each level, at the levels asked for. */
  curve?: CurvePoint[];
}

/**
 * The simulation, priced: each world's events, as the push they gave the
 * price period by period (`pushes[world][period]`, a multiple applied as the
 * period opens), run through thousands of the market's own paths. A handful
 * of worlds is too few to count outcomes in; this keeps what each world's
 * story did to the price and lets the market's randomness average out, so
 * the worlds pooled read as a probability, not as a tally of three coin
 * tosses.
 */
export function pricedWorlds(m: Measure, price: number, returns: number[], steps: number[], pushes: number[][], seed: number, perWorld = 2000, levels: number[] = []): Priced {
  const draw = rng(seed);
  const n = returns.length;
  const finals: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  let hits = 0;
  const above = m.direction !== 'below';
  const at = (level: number) => (above ? level >= m.threshold! : level <= m.threshold!);
  for (const push of pushes.length ? pushes : [[]]) {
    for (let p = 0; p < perWorld; p++) {
      // The path's level as a multiple of the price, its highest and lowest, a world's pushes applied as each period opens.
      let x = 0, lift = 1, hi = 1, lo = 1;
      for (let i = 0; i < steps.length; i++) {
        lift *= push[i] ?? 1;
        let v = Math.exp(x) * lift;
        if (v > hi) hi = v;
        if (v < lo) lo = v;
        for (let d = 0; d < steps[i] && n; d++) {
          x += returns[Math.floor(draw() * n)];
          v = Math.exp(x) * lift;
          if (v > hi) hi = v;
          if (v < lo) lo = v;
        }
      }
      const end = price * Math.exp(x) * lift;
      finals.push(end);
      highs.push(hi);
      lows.push(lo);
      if (m.threshold !== undefined && (m.touch ? at(price * (above ? hi : lo)) : at(end))) hits++;
    }
  }
  const curve = levels.length ? touchCurve(price, highs, lows, levels) : undefined;
  finals.sort((a, b) => a - b);
  return {
    ...(m.threshold !== undefined ? { probability: hits / finals.length } : {}),
    p10: quantile(finals, 0.1), p50: quantile(finals, 0.5), p90: quantile(finals, 0.9),
    ...(curve ? { curve } : {}),
  };
}
