import { msg, type Translate } from '@/lib/core/i18n/translator';
import { DESCRIPTION_RANGE, fit, nameOf, TITLE_MAX } from '../copy/format';
import type { Place } from '../place';
import type { MapLink, PlaceCopy, PlaceTopic, TopicPage } from '../topic';
import { INDICATORS, type IndicatorMetricMeta, type IndicatorRow, type IndicatorSeries, type IndicatorSpec } from './indicators-data';
import { basisOf, chartedFrom, formatValue, HUB_INDEX, indicatorIndexed, indicatorSentences, projectionName } from './indicators-facts';
import { indicatorTable } from './indicators-table';

/**
 * A country in numbers: /country/<place>/statistics lists every History indicator the country has, and each has a
 * page of its own, /country/turkey/life-expectancy, charting it year by year with its projection where the source
 * publishes one (tools/site/topics/indicators.ts). The measure pages stay out of the place's nav and overview, which
 * list the hub; a measure is indexed by INDICATOR_INDEX, the hub from HUB_INDEX indexed measures.
 */

export type IndicatorData =
  | { kind: 'hub'; row: IndicatorRow; measures: TopicPage<IndicatorMeasure>[] }
  | ({ kind: 'measure' } & IndicatorMeasure);

export interface IndicatorMeasure { spec: IndicatorSpec; series: IndicatorSeries; meta?: IndicatorMetricMeta; row: IndicatorRow }

export const HUB_SLUG = 'statistics';
/** The measures the hub's header shows first, where the country has them. */
export const HEADLINE = ['life-expectancy', 'population', 'gdp-per-person', 'temperature'];

const built = new WeakMap<IndicatorRow, TopicPage<IndicatorData>[]>();

function pagesOf(row: IndicatorRow, metrics: Record<string, IndicatorMetricMeta>, year: number): TopicPage<IndicatorData>[] {
  const measures: TopicPage<IndicatorMeasure>[] = INDICATORS.flatMap(spec => {
    const series = row.m[spec.slug];
    return series ? [{ slug: spec.slug, label: spec.label, listed: false, index: indicatorIndexed(series.f, year), data: { spec, series, meta: metrics[spec.slug], row } }] : [];
  });
  if (!measures.length) return [];
  const hub: TopicPage<IndicatorData> = { slug: HUB_SLUG, data: { kind: 'hub', row, measures }, index: measures.filter(m => m.index).length >= HUB_INDEX };
  return [hub, ...measures.map(m => ({ ...m, data: { kind: 'measure' as const, ...m.data } }))];
}

/** The span the hub covers: its measures' first charted year and latest value, and where their projections end. */
export function hubSpan(measures: TopicPage<IndicatorMeasure>[]) {
  const from = Math.min(...measures.map(m => chartedFrom(m.data.spec, m.data.series)));
  const to = Math.max(...measures.map(m => m.data.series.f.last[0]));
  const projTo = Math.max(0, ...measures.map(m => m.data.series.f.proj?.[0] ?? 0));
  return { from, to, projTo: projTo || undefined };
}

function measureCopy(place: Place, m: IndicatorMeasure, t: Translate): PlaceCopy {
  const { spec, series: s } = m;
  const f = s.f;
  const v = (t: Translate, x: number) => formatValue(spec, x, t);
  const vars = (t: Translate) => ({
    metric: t(spec.label), place: nameOf(place, t), from: String(chartedFrom(spec, s)), to: String(f.last[0]), start: String(f.first[0]),
    first: v(t, f.first[1]), last: v(t, f.last[1]), by: spec.by, basis: basisOf(spec),
    ...(f.proj && { proj: v(t, f.proj[1]), projTo: String(f.proj[0]), projection: spec.projection ? projectionName(spec.projection, t) : '' }),
  });
  const projected = !!f.proj;
  const modelled = basisOf(spec) === 'modelled';
  const sentences = indicatorSentences(spec, s, m.meta, nameOf(place, t), t);
  return {
    title: fit([
      ...(projected ? [(t: Translate) => t('{metric} in {place} since {from}, projected to {projTo}', vars(t))] : []),
      t => t('{metric} in {place} since {from}', vars(t)),
      t => t('{metric} in {place}', vars(t)),
    ], t, TITLE_MAX),
    description: fit([
      ...(projected && !modelled ? [
        (t: Translate) => t('{metric} in {place} from {start} to {to}: {first} in {start}, {last} in {to}, and {proj} by {projTo} in the {projection}.', vars(t)),
        (t: Translate) => t('{metric} in {place} from {start} to {to}: {first} in {start}, {last} in {to}, and a projected {proj} by {projTo}. Every year charted.', vars(t)),
        (t: Translate) => t('{metric} in {place}: {first} in {start}, {last} in {to}, and a projected {proj} by {projTo}, every year on a chart.', vars(t)),
      ] : []),
      ...(projected && modelled ? [
        (t: Translate) => t('{metric} in {place} as climate models run it: {first} in {start}, {last} in {to}, and a projected {proj} by {projTo} under SSP2-4.5. Every year charted.', vars(t)),
        (t: Translate) => t('{metric} in {place}, modelled: {first} in {start}, {last} in {to}, and {proj} projected for {projTo}, every year on a chart.', vars(t)),
      ] : []),
      t => t('{metric} in {place} from {start} to {to}: {first} in {start} and {last} in {to}, {basis, select, observed {by {by} observations} other {by {by} estimates}}, with every year on a chart.', vars(t)),
      t => t('{metric} in {place}, year by year from {start} to {to}: every value on a chart and in a table, with its source and what it measures.', vars(t)),
      t => t('{metric} in {place}, {start} to {to}: every year’s value charted and listed here, with its source and what it measures.', vars(t)),
    ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
    heading: t('{metric} in {place}', vars(t)),
    // The header's figures carry the rest (indicators-body.tsx).
    lede: sentences[0],
  };
}

function hubCopy(place: Place, measures: TopicPage<IndicatorMeasure>[], t: Translate): PlaceCopy {
  const span = hubSpan(measures);
  const vars = (t: Translate) => ({ place: nameOf(place, t), n: measures.length, from: String(span.from), to: String(span.to), projTo: String(span.projTo ?? '') });
  return {
    title: fit([
      t => t('{place} in numbers: {n} measures from {from} to {to}', vars(t)),
      t => t('{place} in numbers: {n} measures over time', vars(t)),
      t => t('{place} in numbers', vars(t)),
    ], t, TITLE_MAX),
    description: fit([
      ...(span.projTo ? [
        (t: Translate) => t('{n} measures of {place} through time, each charted year by year from {from} to {to} with its source, and projections to {projTo} where published.', vars(t)),
      ] : []),
      t => t('{place} in numbers: {n} measures through time, charted year by year from {from} to {to}, each with its source and what it measures.', vars(t)),
    ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
    heading: t('{place} in numbers', vars(t)),
    lede: [
      t('{n} measures of {place} from {from} to {to}, each charted year by year with where it comes from.', vars(t)),
      ...(span.projTo ? [t('Where a source publishes projections, they run on to {projTo}, drawn apart from the estimates.', vars(t))] : []),
    ].join(' '),
  };
}

/** History colouring the countries by the measure and playing it from its first year, with this country charted. */
function openOn(place: Place, spec: IndicatorSpec, series: IndicatorSeries, row: IndicatorRow): MapLink {
  // History's clock reaches back to 3000 BCE.
  const from = Math.max(series.f.first[0], -2999);
  const to = new Date().getUTCFullYear();
  return {
    mode: {
      view: 'history', year: from, layer: null, range: { from, to },
      metric: spec.map.code, ...(spec.map.source && { source: spec.map.source }), ...(row.key && { countries: [row.key] }),
    },
  };
}

export const INDICATOR_TOPIC: PlaceTopic<IndicatorData> = {
  id: 'indicators',
  label: msg('Statistics'),
  inline: msg('statistics'),
  kinds: ['country'],
  openLabel: msg('Watch it change on the map'),

  pages(place) {
    const { rows, meta } = indicatorTable();
    const row = rows[String(place.id)];
    if (!row || !meta) return [];
    let pages = built.get(row);
    if (!pages) built.set(row, (pages = pagesOf(row, meta.metrics, meta.year)));
    return pages;
  },

  header(place, { data }, t) {
    return data.kind === 'hub' ? hubCopy(place, data.measures, t) : measureCopy(place, data, t);
  },

  summary(place, { data }, t) {
    if (data.kind === 'measure') return indicatorSentences(data.spec, data.series, data.meta, nameOf(place, t), t)[0];
    const span = hubSpan(data.measures);
    return t('{n} measures charted year by year, from {from} to {to}.', { n: data.measures.length, from: String(span.from), to: String(span.to) });
  },

  open(place, { data }) {
    if (data.kind === 'measure') return openOn(place, data.spec, data.series, data.row);
    const lead = data.measures.find(m => m.slug === HEADLINE[0]) ?? data.measures[0];
    return openOn(place, lead.data.spec, lead.data.series, data.row);
  },
};

export type IndicatorPage = TopicPage<IndicatorData>;
