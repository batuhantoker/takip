import { msg, type Translate } from '@/lib/core/i18n/translator';
import type { IndicatorFacts, IndicatorMetricMeta, IndicatorSeries, IndicatorSpec, Projector, ValueStyle } from './indicators-data';

/**
 * What a country's measure page says, from the facts the builder worked out (tools/site/topics/indicators.ts), and
 * whether it is worth a search result. Every sentence names what its numbers are: estimated, observed, modelled or
 * projected, and whose.
 */

/** A page is indexed with this many yearly points, the latest this recent, and not one value throughout. */
export const INDICATOR_INDEX = { points: 10, recentYears: 15 } as const;
/** The statistics hub is indexed once this many of its measures are. */
export const HUB_INDEX = 5;

export function indicatorIndexed(f: IndicatorFacts, year: number): boolean {
  return f.n >= INDICATOR_INDEX.points && f.last[0] >= year - INDICATOR_INDEX.recentYears && f.max[1] !== f.min[1];
}

const MILLION = 1_000_000;

/** The number alone, in the reader's language: "77.2", "85.3 million", "$15,880", "$25.4B". */
export function formatNumber(v: number, style: ValueStyle, digits: number, t: Translate): string {
  if (style === 'usd') {
    return new Intl.NumberFormat(t.intl, Math.abs(v) >= MILLION
      ? { style: 'currency', currency: 'USD', notation: 'compact', maximumSignificantDigits: 3 }
      : { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
  }
  if (style === 'count' && Math.abs(v) >= MILLION) {
    return new Intl.NumberFormat(t.intl, { notation: 'compact', compactDisplay: 'long', maximumSignificantDigits: 3 }).format(v);
  }
  return new Intl.NumberFormat(t.intl, { maximumFractionDigits: digits }).format(v);
}

/** A value with its unit: "77.2 years", "45%", "13 °C". */
export const formatValue = (spec: Pick<IndicatorSpec, 'style' | 'digits' | 'value'>, v: number, t: Translate) =>
  t(spec.value, { v: formatNumber(v, spec.style, spec.digits, t) });

/** "UN projection (medium variant)". */
export function projectionName(p: Projector, t: Translate): string {
  return p.scenario ? t('{projection} ({scenario})', { projection: t(p.name), scenario: t(p.scenario) }) : t(p.name);
}

/** What the numbers are: a model's run, observations, or estimates. */
export const basisOf = (spec: IndicatorSpec) => (spec.modelled ? 'modelled' : spec.observed ? 'observed' : 'estimated');

const at = (year: number) => String(year);

/** The first year charted with the page's series: the earlier run's where it reaches back. */
export const chartedFrom = (spec: IndicatorSpec, s: IndicatorSeries) => (spec.earlier && s.f.before ? s.f.before[0] : s.f.first[0]);

const MODELLED = msg('CMIP6 historical run, model median');

/**
 * The page's sentences in order: the span, the projection, the extremes, the rank, the World, the older run. The
 * first two are the lede.
 */
export function indicatorSentences(spec: IndicatorSpec, s: IndicatorSeries, meta: IndicatorMetricMeta | undefined, place: string, t: Translate): string[] {
  const f = s.f;
  const v = (x: number) => formatValue(spec, x, t);
  const out: string[] = [
    t('{metric} in {place}: {first} in {from} and {last} in {to}, {basis, select, modelled {in the {by} climate models’ median run} observed {by {by} observations} other {by {by} estimates}}.', {
      metric: t(spec.label), place, first: v(f.first[1]), from: at(f.first[0]), last: v(f.last[1]), to: at(f.last[0]), basis: basisOf(spec), by: spec.by,
    }),
  ];
  if (f.proj && spec.projection) {
    const [year, pv, lo, hi] = f.proj;
    const projection = projectionName(spec.projection, t);
    out.push(lo !== undefined && hi !== undefined && spec.projection.range
      // WPP's bounds follow fertility, so for an ageing measure its "lower" bound is the higher value.
      ? t('The {projection} puts it at {v} in {year}, between {lo} and {hi} ({range}).', { projection, v: v(pv), year: at(year), lo: v(Math.min(lo, hi)), hi: v(Math.max(lo, hi)), range: t(spec.projection.range) })
      : t('The {projection} puts it at {v} in {year}.', { projection, v: v(pv), year: at(year) }));
  }
  const ends = (p: [number, number]) => p[0] === f.first[0] || p[0] === f.last[0];
  if (!ends(f.max) || !ends(f.min)) {
    out.push(t('The highest was {max} in {maxYear}, the lowest {min} in {minYear}.', { max: v(f.max[1]), maxYear: at(f.max[0]), min: v(f.min[1]), minYear: at(f.min[0]) }));
  }
  // A place shared with others (most countries at zero deaths) says nothing.
  if (f.rank && f.rank.length === 2 && meta?.rankYear !== undefined) {
    const [rank, n] = f.rank;
    out.push(t('{pos, select, top {In {year}, {place} had the highest value of {n} countries.} bottom {In {year}, {place} had the lowest value of {n} countries.} other {In {year}, {place} ranked {rank} of {n} countries, counting from the highest.}}', {
      pos: rank === 1 ? 'top' : rank === n ? 'bottom' : 'other', year: at(meta.rankYear), place, rank, n,
    }));
  }
  if (f.world !== undefined) out.push(t('The world as a whole: {v} in {year}.', { v: v(f.world), year: at(f.last[0]) }));
  const older = spec.earlier ?? spec.longRun;
  if (f.before && older) {
    const bv = spec.longRun ? t(spec.longRun.value, { v: formatNumber(f.before[1], 'number', 0, t) }) : v(f.before[1]);
    out.push(t('Older estimates from {by} reach back to {year}: {v}.', { by: older.by, year: at(f.before[0]), v: bv }));
  }
  return out;
}

/** What each line on the chart is, for its legend and table. */
export function seriesNames(spec: IndicatorSpec, t: Translate) {
  return {
    main: spec.modelled ? t(MODELLED) : spec.observed ? t('Observed, {by}', { by: spec.by }) : t('Estimates, {by}', { by: spec.by }),
    model: spec.model ? t(MODELLED) : undefined,
    projection: spec.projection ? projectionName(spec.projection, t) : undefined,
    range: spec.projection?.range ? t(spec.projection.range) : undefined,
    earlier: spec.earlier ? t('Estimates, {by}', { by: spec.earlier.by }) : undefined,
  };
}
