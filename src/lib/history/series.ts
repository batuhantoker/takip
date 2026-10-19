import { DEFAULT_LOCALE } from '@/lib/core/i18n/locales';
import { createTranslator, type Translate } from '@/lib/core/i18n/translator';
import type { Projection } from './projection';

/*
 * Country-year series for the replay choropleth: the payload from /api/replay/history/series, the value
 * at a moment, and one colour scale per metric, fixed across all years so colours compare through time.
 */

/**
 * [calendar year, value] or, painted from a historical polity, [year, value, that polity's key].
 * In a 'day' series the year is fractional, the point's date.
 */
export type ShapePoint = [number, number] | [number, number, string];

/** 'day' series hold dated (weekly) points; absent means yearly. */
export type Step = 'year' | 'day';

export type SeriesPayload = {
  metric: { code: string; name: string; unit: string | null; topic: string | null };
  source: { code: string; name: string; attribution: string | null };
  sources: { code: string; name: string; points: number }[];
  /** By countries.json `id`. */
  values: Record<string, ShapePoint[]>;
  /** Names of the historical polities that `via` keys refer to. */
  names: Record<string, string>;
  years: [number, number] | null;
  step?: Step;
  /** Set when projections follow the estimates (projection.ts). */
  projection?: Projection;
};

/** `years`: the first and last point, as SeriesPayload.years reports them. */
export type CatalogueMetric = { code: string; name: string; unit: string | null; topic: string | null; subjects: number; years?: [number, number] | null };

/** Points further apart than this (MAX_GAP_DAYS in a 'day' series) aren't joined: the time between shows as no data. */
export const MAX_GAP_YEARS = 10;
export const MAX_GAP_DAYS = 56;
const DAYS_PER_YEAR = 365.25;
const HALF_WEEK_YEARS = 3.5 / DAYS_PER_YEAR;

/**
 * `v` drives the colour and moves smoothly between points; `shown` is what to print: the recorded value
 * when the year (or, in a 'day' series, the week) has one, else the estimate between the two points around it.
 * `year` and `between` are the points' own x. `projected` marks a projected value, never a measured one, and
 * `range` is the publisher's own range around it ("95% prediction interval"); `note` names a simulated year's value.
 */
type Projected = { projected?: true; range?: { lo: number; hi: number; label: string }; note?: string };
export type Reading =
  | ({ v: number; shown: number; kind: 'recorded'; year: number; via?: string } & Projected)
  | ({ v: number; shown: number; kind: 'interpolated'; between: [number, number]; via?: string } & Projected);

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

/** Fractional calendar year → epoch ms; the inverse of yearAt. */
export function msAt(y: number) {
  const year = Math.floor(y);
  const start = utcYearStart(year);
  return start + (y - year) * (utcYearStart(year + 1) - start);
}

/**
 * A year's value counts from mid-year, so playback passes through each recorded value. A dated point
 * counts from its date, and is the recorded value for the half week either side of it. Points from
 * `projectedFrom` on are projections: never blended with the estimates before them.
 */
export function readingAt(points: readonly ShapePoint[], y: number, step: Step = 'year', projectedFrom?: number): Reading | null {
  const dated = step === 'day';
  const year = Math.floor(y);
  const c = dated ? y : y - 0.5;
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
  const isExact = (p: ShapePoint | undefined) => !!p && (dated ? Math.abs(p[0] - y) <= HALF_WEEK_YEARS : p[0] === year);
  const exact = isExact(a) ? a : isExact(b) ? b : undefined;
  const isProjected = (p: ShapePoint) => projectedFrom !== undefined && p[0] >= projectedFrom;
  let v: number | undefined;
  if (a && b && b[0] - a[0] <= (dated ? MAX_GAP_DAYS / DAYS_PER_YEAR : MAX_GAP_YEARS) && isProjected(a) === isProjected(b)) {
    v = a[1] + ((b[1] - a[1]) * (c - a[0])) / (b[0] - a[0]);
  } else if (exact) v = exact[1];
  if (v === undefined) return null;
  if (exact) return { v, shown: exact[1], kind: 'recorded', year: exact[0], via: exact[2], ...(isProjected(exact) && { projected: true }) };
  return { v, shown: v, kind: 'interpolated', between: [a![0], b![0]], via: a![2] ?? b![2], ...(isProjected(a!) && { projected: true }) };
}

/** The value a series has at exactly `x`, if any. */
function valueAt(points: readonly ShapePoint[] | undefined, x: number): number | undefined {
  if (!points) return undefined;
  let lo = 0;
  let hi = points.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid][0] === x) return points[mid][1];
    if (points[mid][0] < x) lo = mid + 1;
    else hi = mid - 1;
  }
  return undefined;
}

/** A country's reading at fractional year `y`, its projected years marked, with the published range where there is one. */
export function countryReading(data: SeriesPayload, key: string, y: number): Reading | null {
  const points = data.values[key];
  const p = data.projection;
  const read = points ? readingAt(points, y, data.step, p?.starts[key]) : null;
  const year = read && (read.kind === 'recorded' ? read.year : read.between[1]);
  const r = read && p?.simulated && read.projected && year! <= p.simulated.to ? { ...read, note: p.simulated.label } : read;
  if (!r?.projected || r.kind !== 'recorded' || !p?.range) return r;
  const lo = valueAt(p.range.lo[key], r.year);
  const hi = valueAt(p.range.hi[key], r.year);
  return lo === undefined || hi === undefined ? r : { ...r, range: { lo, hi, label: p.range.label } };
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
  // Half the values at the floor (weeks without a COVID death) would leave a linear map nearly one colour.
  const log = lo >= 0 && ((hi + 1) / (lo + 1) >= 100 || q(0.5) <= lo);
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
// Light → dark steel blue, even steps in OKLCH lightness with quiet ends; see rampFor.
const BLUES = ['#bbd6e4', '#90bad3', '#6a9dbf', '#4e80a6', '#3b6387', '#2e4864', '#222f3f'];

/** Low → high. On a dark map the low end recedes into the surface, so the ramp runs dark → light there. */
export const rampFor = (dark: boolean) => (dark ? [...BLUES].reverse() : BLUES);

/** Short units ride along with each number; long ones are printed once, under the metric's name. */
export const unitInline = (unit: string | null) => (unit && unit.length <= 12 ? unit : null);

const numberFormats = new Map<string, Intl.NumberFormat>();
const numberFormat = (intl: string, kind: 'compact' | 'whole' | 'tenths' | 'small') => {
  const key = `${intl}|${kind}`;
  let f = numberFormats.get(key);
  if (!f) {
    const options: Intl.NumberFormatOptions = kind === 'compact' ? { notation: 'compact', maximumSignificantDigits: 3 }
      : kind === 'whole' ? { maximumFractionDigits: 0 }
        : kind === 'tenths' ? { minimumFractionDigits: 1, maximumFractionDigits: 1 }
          : { minimumSignificantDigits: 2, maximumSignificantDigits: 2 };
    numberFormats.set(key, (f = new Intl.NumberFormat(intl, options)));
  }
  return f;
};

/** English keeps its spaced T/B/M/k; other languages get their own short forms (Mrd., млн, 億…). */
export function formatValue(v: number, unit: string | null = null, intl = 'en'): string {
  const abs = Math.abs(v);
  const en = intl === 'en';
  let text: string;
  if (!en && abs >= 1e4) text = numberFormat(intl, 'compact').format(v);
  else if (abs >= 1e12) text = `${(v / 1e12).toPrecision(3)} T`;
  else if (abs >= 1e9) text = `${(v / 1e9).toPrecision(3)} B`;
  else if (abs >= 1e6) text = `${(v / 1e6).toPrecision(3)} M`;
  else if (abs >= 1e4) text = `${(v / 1e3).toPrecision(3)} k`;
  else if (abs >= 100) text = numberFormat(intl, 'whole').format(Math.round(v));
  else if (abs >= 1) text = en ? v.toFixed(1) : numberFormat(intl, 'tenths').format(v);
  else text = v === 0 ? '0' : en ? v.toPrecision(2) : numberFormat(intl, 'small').format(v);
  const inline = unitInline(unit);
  if (!inline) return text;
  return inline === '%' ? `${text}%` : `${text} ${inline}`;
}

const EN = createTranslator(DEFAULT_LOCALE, {});

/** A calendar year, astronomical (0 is 1 BCE) → "1950" or "500 BCE". */
export const formatYear = (year: number, t: Translate = EN) => (year > 0 ? String(year) : t('{year} BCE', { year: String(1 - year) }));

const DATES = new Map<string, Intl.DateTimeFormat>();
const DAY_MS = 86_400_000;
const dateFormat = (intl: string) => {
  const tag = intl === 'en' ? 'en-GB' : intl;
  let f = DATES.get(tag);
  if (!f) DATES.set(tag, (f = new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })));
  return f;
};

/** A point's x → "1950", or "5 Apr 2020" in a 'day' series. */
export const formatAt = (x: number, step: Step = 'year', t: Translate = EN) =>
  step === 'day' ? dateFormat(t.intl).format(Math.round(msAt(x) / DAY_MS) * DAY_MS) : formatYear(x, t);

/** `projection` names a projected reading ("UN projection (medium variant)"). */
export function readingText(r: Reading, unit: string | null, names: Record<string, string>, step: Step = 'year', projection?: string, t: Translate = EN): string {
  const value = formatValue(r.shown, unit, t.intl);
  const via = r.via ? t('{name} value', { name: names[r.via] ?? r.via }) : null;
  const named = r.note ?? projection ?? t('projection');
  const projected = !r.projected ? null : r.range
    ? t('{projection}, {range} {lo}–{hi}', { projection: named, range: r.range.label, lo: formatValue(r.range.lo, null, t.intl), hi: formatValue(r.range.hi, null, t.intl) })
    : named;
  const head = r.kind === 'recorded'
    ? (step === 'day' ? t('{value} on {date}', { value, date: formatAt(r.year, step, t) }) : t('{value} in {date}', { value, date: formatAt(r.year, step, t) }))
    : t('≈ {value}, between {from} and {to}', { value, from: formatAt(r.between[0], step, t), to: formatAt(r.between[1], step, t) });
  return [head, via, projected].filter(Boolean).join(' · ');
}
