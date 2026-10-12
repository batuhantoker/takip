/*
 * Country-year series for the replay choropleth: the payload from /api/replay/history/series, the value
 * at a moment, and one colour scale per metric, fixed across all years so colours compare through time.
 */

/** [calendar year, value] or, painted from a historical polity, [year, value, that polity's key]. */
export type ShapePoint = [number, number] | [number, number, string];

export type SeriesPayload = {
  metric: { code: string; name: string; unit: string | null; topic: string | null };
  source: { code: string; name: string; attribution: string | null };
  sources: { code: string; name: string; points: number }[];
  /** By countries.json `id`. */
  values: Record<string, ShapePoint[]>;
  /** Names of the historical polities that `via` keys refer to. */
  names: Record<string, string>;
  years: [number, number] | null;
};

export type CatalogueMetric = { code: string; name: string; unit: string | null; topic: string | null; subjects: number };

/** Points further apart than this aren't joined: the years between them show as no data. */
export const MAX_GAP_YEARS = 10;

/**
 * `v` drives the colour and moves smoothly between points; `shown` is what to print: the recorded value
 * when the year has one, else the estimate between the two points around it.
 */
export type Reading =
  | { v: number; shown: number; kind: 'recorded'; year: number; via?: string }
  | { v: number; shown: number; kind: 'interpolated'; between: [number, number]; via?: string };

function utcYearStart(year: number) {
  const d = new Date(0);
  d.setUTCFullYear(year, 0, 1);
  return d.getTime();
}

/** Epoch ms → a fractional calendar year: 1950.5 is about 2 July 1950. */
export function yearAt(ms: number) {
  const year = new Date(ms).getUTCFullYear();
  const start = utcYearStart(year);
  return year + (ms - start) / (utcYearStart(year + 1) - start);
}

/** A year's value counts from mid-year, so playback passes through each recorded value. */
export function readingAt(points: readonly ShapePoint[], y: number): Reading | null {
  const year = Math.floor(y);
  const c = y - 0.5;
  let lo = 0;
  let hi = points.length - 1;
  let i = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid][0] <= c) {
      i = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  const a = i >= 0 ? points[i] : undefined;
  const b = points[i + 1];
  const exact = a?.[0] === year ? a : b?.[0] === year ? b : undefined;
  let v: number | undefined;
  if (a && b && b[0] - a[0] <= MAX_GAP_YEARS) v = a[1] + ((b[1] - a[1]) * (c - a[0])) / (b[0] - a[0]);
  else if (exact) v = exact[1];
  if (v === undefined) return null;
  if (exact) return { v, shown: exact[1], kind: 'recorded', year, via: exact[2] };
  return { v, shown: v, kind: 'interpolated', between: [a![0], b![0]], via: a![2] ?? b![2] };
}

export type Scale = { lo: number; hi: number; log: boolean; norm(v: number): number; at(f: number): number };

/**
 * One scale over every year: the 2nd to 98th percentile, so a few extremes don't wash out the rest.
 * Heavy-tailed metrics (deaths, people, money) get log1p, which keeps real zeros at the bottom.
 */
export function scaleFor(values: Record<string, readonly ShapePoint[]>): Scale | null {
  const all: number[] = [];
  for (const points of Object.values(values)) for (const p of points) all.push(p[1]);
  if (!all.length) return null;
  all.sort((x, y) => x - y);
  const q = (f: number) => all[Math.min(all.length - 1, Math.max(0, Math.round(f * (all.length - 1))))];
  let lo = q(0.02);
  let hi = q(0.98);
  if (hi <= lo) {
    lo = all[0];
    hi = all[all.length - 1];
  }
  if (hi <= lo) hi = lo + 1;
  const log = lo >= 0 && (hi + 1) / (lo + 1) >= 100;
  const f = (x: number) => (log ? Math.log1p(Math.max(0, x)) : x);
  const flo = f(lo);
  const fhi = f(hi);
  return {
    lo,
    hi,
    log,
    norm: v => Math.min(1, Math.max(0, (f(v) - flo) / (fhi - flo))),
    at: t => (log ? Math.expm1 : (x: number) => x)(flo + t * (fhi - flo)),
  };
}

/** Sequential blue, light → dark (dataviz palette steps 100–700). */
const BLUES = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#104281'];

/** Low → high. On a dark map the low end recedes into the surface, so the ramp runs dark → light there. */
export const rampFor = (dark: boolean) => (dark ? [...BLUES].reverse() : BLUES);

/** Short units ride along with each number; long ones are printed once, under the metric's name. */
export const unitInline = (unit: string | null) => (unit && unit.length <= 12 ? unit : null);

export function formatValue(v: number, unit: string | null = null): string {
  const abs = Math.abs(v);
  let text: string;
  if (abs >= 1e12) text = `${(v / 1e12).toPrecision(3)} T`;
  else if (abs >= 1e9) text = `${(v / 1e9).toPrecision(3)} B`;
  else if (abs >= 1e6) text = `${(v / 1e6).toPrecision(3)} M`;
  else if (abs >= 1e4) text = `${(v / 1e3).toPrecision(3)} k`;
  else if (abs >= 100) text = Math.round(v).toLocaleString('en-US');
  else if (abs >= 1) text = v.toFixed(1);
  else text = v === 0 ? '0' : v.toPrecision(2);
  const inline = unitInline(unit);
  if (!inline) return text;
  return inline === '%' ? `${text}%` : `${text} ${inline}`;
}

/** A calendar year, astronomical (0 is 1 BCE) → "1950" or "500 BCE". */
export const formatYear = (year: number) => (year > 0 ? String(year) : `${1 - year} BCE`);

export function readingText(r: Reading, unit: string | null, names: Record<string, string>): string {
  const value = formatValue(r.shown, unit);
  const via = r.via ? ` · ${names[r.via] ?? r.via} value` : '';
  return r.kind === 'recorded'
    ? `${value} in ${formatYear(r.year)}${via}`
    : `≈ ${value}, between ${formatYear(r.between[0])} and ${formatYear(r.between[1])}${via}`;
}
