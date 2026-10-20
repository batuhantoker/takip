import type { Translate } from '@/lib/core/i18n/translator';
import { DESCRIPTION_RANGE, fit, nameOf, TITLE_MAX } from '../places/copy/format';
import { placeById } from '../places/gazetteer';
import type { Place } from '../places/place';
import type { MapLink, PlaceCopy } from '../places/topic';
import { indicatorSpec, INDICATORS, type IndicatorMetricMeta, type IndicatorSeries, type IndicatorSpec } from '../places/topics/indicators-data';
import { basisOf, formatValue } from '../places/topics/indicators-facts';
import { indicatorTable } from '../places/topics/indicators-table';

/**
 * One measure around the world at /map/<measure>: every country's latest value, ranked, the World's series and the
 * most populous countries' on one chart. Every measure in the table has one, indexed.
 */

export const WORLD_LINES = 5;

export interface Ranked { place: Place; series: IndicatorSeries; year: number; v: number }

export interface WorldMeasure {
  spec: IndicatorSpec;
  meta?: IndicatorMetricMeta;
  /** Every country with a value, by its latest value, highest first. */
  ranked: Ranked[];
  /** The most populous countries with the measure, for the chart. */
  biggest: Ranked[];
  /** In the measure's rank year, the highest and lowest and how many had a value. */
  top?: { year: number; high: Ranked; low: Ranked; n: number };
  from: number;
  to: number;
}

export const worldPath = (slug: string) => `/map/${slug}`;

/** The measures with a world page: all of them, in the table's order. */
export const worldSlugs = () => INDICATORS.map(s => s.slug);

const built = new WeakMap<object, Map<string, WorldMeasure | null>>();

export function worldMeasure(slug: string): WorldMeasure | null {
  const spec = indicatorSpec(slug);
  if (!spec) return null;
  const { rows, meta } = indicatorTable();
  let cache = built.get(rows);
  if (!cache) built.set(rows, (cache = new Map()));
  if (!cache.has(slug)) cache.set(slug, measureOf(spec, rows, meta?.metrics[slug]));
  return cache.get(slug)!;
}

function measureOf(spec: IndicatorSpec, rows: ReturnType<typeof indicatorTable>['rows'], meta?: IndicatorMetricMeta): WorldMeasure | null {
  const ranked: Ranked[] = Object.entries(rows).flatMap(([id, row]) => {
    const series = row.m[spec.slug];
    const place = series && placeById(Number(id));
    return series && place ? [{ place, series, year: series.f.last[0], v: series.f.last[1] }] : [];
  }).sort((x, y) => y.v - x.v);
  if (!ranked.length) return null;
  const ry = meta?.rankYear;
  const inYear = ry === undefined ? [] : ranked.flatMap(r => {
    const v = r.series.e[1][ry - r.series.e[0]];
    return v === null || v === undefined ? [] : [{ ...r, year: ry, v }];
  }).sort((x, y) => y.v - x.v);
  return {
    spec, meta, ranked,
    biggest: [...ranked].sort((x, y) => y.place.pop - x.place.pop).slice(0, WORLD_LINES),
    ...(ry !== undefined && inYear.length > 1 && { top: { year: ry, high: inYear[0], low: inYear[inYear.length - 1], n: inYear.length } }),
    from: Math.min(...ranked.map(r => r.series.f.first[0]), ...(meta?.world ? [meta.world.e[0]] : [])),
    to: Math.max(...ranked.map(r => r.year)),
  };
}

export function worldSentences(w: WorldMeasure, t: Translate): string[] {
  const v = (x: number) => formatValue(w.spec, x, t);
  const out: string[] = [];
  if (w.top) {
    out.push(t('{metric}, {year}: highest in {high}, at {hv}, and lowest in {low}, at {lv}, of {n} countries with a value.', {
      year: String(w.top.year), metric: t(w.spec.label), high: nameOf(w.top.high.place, t), hv: v(w.top.high.v), low: nameOf(w.top.low.place, t), lv: v(w.top.low.v), n: w.top.n,
    }));
  } else {
    out.push(t('{metric}: {n} countries have figures, the latest from {year}{basis, select, modelled {, modelled} other {}}.', {
      n: w.ranked.length, metric: t(w.spec.label), year: String(w.to), basis: basisOf(w.spec),
    }));
  }
  const world = w.meta?.world;
  if (world) {
    const pts = world.e[1].flatMap((x, i) => (x === null ? [] : [[world.e[0] + i, x] as const]));
    const last = pts[pts.length - 1];
    if (last) out.push(t('The world as a whole: {v} in {year}.', { v: v(last[1]), year: String(last[0]) }));
  }
  return out;
}

export function worldCopy(w: WorldMeasure, t: Translate): PlaceCopy {
  const vars = (t: Translate) => ({
    metric: t(w.spec.label), n: w.ranked.length, from: String(w.from), to: String(w.to),
    ...(w.top && { year: String(w.top.year), high: nameOf(w.top.high.place, t), hv: formatValue(w.spec, w.top.high.v, t), low: nameOf(w.top.low.place, t), lv: formatValue(w.spec, w.top.low.v, t) }),
  });
  return {
    title: fit([
      t => t('{metric} by country, {from} to {to}', vars(t)),
      t => t('{metric} by country', vars(t)),
    ], t, TITLE_MAX),
    description: fit([
      ...(w.top ? [(t: Translate) => t('{metric}, {year}: highest in {high} at {hv}, lowest in {low} at {lv}. Every country’s latest figure, ranked, and a chart since {from}.', vars(t))] : []),
      t => t('{metric} for {n} countries, charted year by year from {from} and ranked by each one’s latest figure, with its source and what it measures.', vars(t)),
      t => t('{metric} for {n} countries, charted year by year from {from} and ranked by each one’s latest figure, with its source.', vars(t)),
    ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
    heading: t('{metric} around the world', vars(t)),
    lede: worldSentences(w, t).join(' '),
  };
}

/** History colouring every country by the measure, playing from its first year. */
export function worldOpen(w: WorldMeasure): MapLink {
  const from = Math.max(w.from, -2999);
  return { mode: { view: 'history', year: from, layer: null, range: { from, to: new Date().getUTCFullYear() }, metric: w.spec.map.code, ...(w.spec.map.source && { source: w.spec.map.source }) } };
}
