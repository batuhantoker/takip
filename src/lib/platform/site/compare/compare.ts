import { MAX_LINK_COUNTRIES } from '@/lib/map/view-mode-link';
import type { Place } from '../places/place';
import type { MapLink } from '../places/topic';
import { HUB_INDEX, indicatorIndexed } from '../places/topics/indicators-facts';
import { INDICATORS, type IndicatorMetricMeta, type IndicatorSeries, type IndicatorSpec, type Yearly } from '../places/topics/indicators-data';
import { indicatorRow, indicatorTable } from '../places/topics/indicators-table';
import { pairReasons, pairSlug, type CountryPair } from './pairs';

/**
 * Two countries side by side, /compare/<a>-vs-<b> and /compare/<a>-vs-<b>/<measure>, from the same table as the
 * countries' own statistics pages (data/site/topics/indicators.json). Any two countries render; a listed pair's
 * measure is indexed when both countries' own pages for it are and they share COMMON_YEARS years, and its overview
 * once PAIR_INDEX of its measures are.
 */

export const COMMON_YEARS = 10;
export const PAIR_INDEX = HUB_INDEX;

export interface PairMeasure {
  spec: IndicatorSpec;
  a: IndicatorSeries;
  b: IndicatorSeries;
  meta?: IndicatorMetricMeta;
  /** The years both have a value for, oldest first. */
  common: number[];
  index: boolean;
}

export const comparePath = (pair: CountryPair, measure?: string) => `/compare/${pairSlug(pair.a, pair.b)}${measure ? `/${measure}` : ''}`;

const valuesOf = ([from, values]: Yearly) => new Map(values.flatMap((v, i) => (v === null ? [] : [[from + i, v] as [number, number]])));

export function commonYears(a: Yearly, b: Yearly): number[] {
  const other = valuesOf(b);
  return [...valuesOf(a).keys()].filter(y => other.has(y));
}

const built = new WeakMap<object, Map<string, PairMeasure[]>>();

/** Every measure both countries have, in the table's order. A listed pair's are kept per table, as the sitemap asks for them all. */
export function pairMeasures(pair: CountryPair): PairMeasure[] {
  if (pairReasons(pair.a, pair.b) === null) return measuresOf(pair);
  const { rows } = indicatorTable();
  let byPair = built.get(rows);
  if (!byPair) built.set(rows, (byPair = new Map()));
  const key = `${pair.a.id}-${pair.b.id}`;
  let found = byPair.get(key);
  if (!found) byPair.set(key, (found = measuresOf(pair)));
  return found;
}

function measuresOf({ a, b }: CountryPair): PairMeasure[] {
  const { meta } = indicatorTable();
  const ra = indicatorRow(a.id);
  const rb = indicatorRow(b.id);
  if (!ra || !rb || !meta) return [];
  const listed = pairReasons(a, b) !== null;
  return INDICATORS.flatMap(spec => {
    const sa = ra.m[spec.slug];
    const sb = rb.m[spec.slug];
    if (!sa || !sb) return [];
    const common = commonYears(sa.e, sb.e);
    const index = listed && common.length >= COMMON_YEARS && indicatorIndexed(sa.f, meta.year) && indicatorIndexed(sb.f, meta.year);
    return [{ spec, a: sa, b: sb, meta: meta.metrics[spec.slug], common, index }];
  });
}

/** Who had the higher value in a year: 'a', 'b' or 'tie'. */
export type Lead = 'a' | 'b' | 'tie';

export interface PairFacts {
  /** The latest year both have a value for, and their values then. */
  year: number;
  av: number;
  bv: number;
  lead: Lead;
  /** The first year of the leader's unbroken run up to `year`, over the years both have, and who led the year before it. */
  since: number;
  before?: Lead;
  /** The first year both have. */
  from: number;
}

/** Who leads now and since when, over the years both have a value; undefined where they share none. */
export function pairFacts(m: Pick<PairMeasure, 'a' | 'b' | 'common'>): PairFacts | undefined {
  if (!m.common.length) return undefined;
  const a = valuesOf(m.a.e);
  const b = valuesOf(m.b.e);
  const leadIn = (y: number): Lead => (a.get(y)! > b.get(y)! ? 'a' : a.get(y)! < b.get(y)! ? 'b' : 'tie');
  const years = m.common;
  const year = years[years.length - 1];
  const lead = leadIn(year);
  let i = years.length - 1;
  while (i > 0 && leadIn(years[i - 1]) === lead) i--;
  return { year, av: a.get(year)!, bv: b.get(year)!, lead, since: years[i], ...(i > 0 && { before: leadIn(years[i - 1]) }), from: years[0] };
}

/** History colouring the countries by the measure (life expectancy for an overview) with the countries charted, as many as it takes. */
export function pairOpen(pair: CountryPair, measures: PairMeasure[], current?: PairMeasure, extra: Place[] = []): MapLink | undefined {
  const m = current ?? measures.find(x => x.spec.slug === 'life-expectancy') ?? measures[0];
  if (!m) return undefined;
  const from = Math.max(Math.min(m.a.f.first[0], m.b.f.first[0]), -2999);
  const countries = [pair.a, pair.b, ...extra].map(p => indicatorRow(p.id)?.key).filter((k): k is string => !!k).slice(0, MAX_LINK_COUNTRIES);
  return {
    mode: {
      view: 'history', year: from, layer: null, range: { from, to: new Date().getUTCFullYear() },
      metric: m.spec.map.code, ...(m.spec.map.source && { source: m.spec.map.source }), ...(countries.length && { countries }),
    },
  };
}
