import type { Translate } from '@/lib/core/i18n/translator';
import { DESCRIPTION_RANGE, EN, fit, listOf, nameOf, TITLE_MAX } from '../places/copy/format';
import type { PlaceCopy } from '../places/topic';
import { basisOf, formatNumber, formatValue, projectionName } from '../places/topics/indicators-facts';
import type { IndicatorSeries, IndicatorSpec } from '../places/topics/indicators-data';
import { PAIR_INDEX, pairFacts, type PairMeasure } from './compare';
import { pairReasons, type CountryPair } from './pairs';

/**
 * What a comparison says, every sentence from the two countries' own series: each one's latest value, the gap and
 * ratio in the latest year both have, who has been higher since when, their ranks and projections.
 */

const at = (y: number) => String(y);

/** "1.06", "12": a ratio to two significant digits past ten. */
const ratioOf = (x: number, y: number, t: Translate) =>
  new Intl.NumberFormat(t.intl, { maximumSignificantDigits: Math.max(x, y) / Math.min(x, y) >= 10 ? 2 : 3 }).format(Math.max(x, y) / Math.min(x, y));

function names(pair: CountryPair, t: Translate) {
  return { a: nameOf(pair.a, t), b: nameOf(pair.b, t) };
}

/** The first year either country's line on the chart starts. */
export const pairFrom = (m: PairMeasure) => Math.min(m.a.f.first[0], m.b.f.first[0]);
export const pairTo = (m: PairMeasure) => Math.max(m.a.f.last[0], m.b.f.last[0]);

export function pairSentences(pair: CountryPair, m: PairMeasure, t: Translate): string[] {
  const { spec, a: sa, b: sb } = m;
  const { a, b } = names(pair, t);
  const v = (x: number) => formatValue(spec, x, t);
  const basis = { basis: basisOf(spec), by: spec.by, metric: t(spec.label) };
  const out: string[] = [
    sa.f.last[0] === sb.f.last[0]
      ? t('{metric} in {year}: {av} in {a} and {bv} in {b}, {basis, select, modelled {in the {by} climate models’ median run} observed {by {by} observations} other {by {by} estimates}}.', {
        ...basis, year: at(sa.f.last[0]), av: v(sa.f.last[1]), bv: v(sb.f.last[1]), a, b,
      })
      : t('{metric}: {av} in {a} in {ay} and {bv} in {b} in {byear}, {basis, select, modelled {in the {by} climate models’ median run} observed {by {by} observations} other {by {by} estimates}}.', {
        ...basis, av: v(sa.f.last[1]), ay: at(sa.f.last[0]), bv: v(sb.f.last[1]), byear: at(sb.f.last[0]), a, b,
      }),
  ];
  const f = pairFacts(m);
  if (f) {
    const lead = f.lead === 'a' ? a : b;
    const other = f.lead === 'a' ? b : a;
    if (f.lead === 'tie') out.push(t('In {year} both had {v}.', { year: at(f.year), v: v(f.av) }));
    else {
      // The gap between two shares is in percentage points, not a share itself.
      const gap = spec.value.includes('%')
        ? t('{v} percentage points', { v: formatNumber(Math.abs(f.av - f.bv), spec.style, spec.digits, t) })
        : v(Math.abs(f.av - f.bv));
      out.push(f.av > 0 && f.bv > 0
        ? t('In {year} the value was higher in {lead}, by {gap}, or {ratio} times that in {other}.', { year: at(f.year), lead, other, gap, ratio: ratioOf(f.av, f.bv, t) })
        : t('In {year} the value was higher in {lead}, by {gap}.', { year: at(f.year), lead, gap }));
      if (f.since === f.from) out.push(t('{lead} has been higher in every year both have figures for since {from}.', { lead, from: at(f.from) }));
      else if (f.before && f.before !== 'tie') out.push(t('{lead} has been higher since {since}, when it overtook {other}.', { lead, other, since: at(f.since) }));
      else out.push(t('{lead} has been higher since {since}.', { lead, since: at(f.since) }));
    }
  }
  const ry = m.meta?.rankYear;
  if (ry !== undefined && sa.f.rank?.length === 2 && sb.f.rank?.length === 2) {
    out.push(t('In {year}, {a} ranked {ra} and {b} ranked {rb} of {n} countries, counting from the highest.', { year: at(ry), a, b, ra: sa.f.rank[0], rb: sb.f.rank[0], n: sa.f.rank[1] }));
  }
  if (spec.projection) {
    const projection = projectionName(spec.projection, t);
    const pa = sa.f.proj;
    const pb = sb.f.proj;
    if (pa && pb && pa[0] === pb[0]) out.push(t('The {projection} puts {a} at {pa} and {b} at {pb} in {year}.', { projection, a, b, pa: v(pa[1]), pb: v(pb[1]), year: at(pa[0]) }));
    else {
      for (const [place, p] of [[a, pa], [b, pb]] as const) {
        if (p) out.push(t('The {projection} puts {place} at {v} in {year}.', { projection, place, v: v(p[1]), year: at(p[0]) }));
      }
    }
  }
  const world = m.meta?.world;
  const wy = f?.year;
  const wv = world && wy !== undefined ? world.e[1][wy - world.e[0]] : null;
  if (wv != null && wy !== undefined) out.push(t('The world as a whole: {v} in {year}.', { v: v(wv), year: at(wy) }));
  return out;
}

function titles(pair: CountryPair, m: PairMeasure) {
  const vars = (t: Translate) => ({ ...names(pair, t), metric: t(m.spec.label), from: at(pairFrom(m)) });
  return [
    (t: Translate) => t('{a} vs {b}: {metric} since {from}', vars(t)),
    (t: Translate) => t('{a} vs {b}: {metric}', vars(t)),
    ...(m.spec.short ? [(t: Translate) => t('{a} vs {b}: {metric}', { ...vars(t), metric: t(m.spec.short!) })] : []),
  ];
}

/**
 * A listed pair's measure page is indexed when compare.ts's bar is met and its title can name both countries and the
 * measure within TITLE_MAX: two long names leave no room (Central African Republic vs Congo - Brazzaville).
 */
export const pairMeasureIndexed = (pair: CountryPair, m: PairMeasure) => m.index && titles(pair, m).some(c => c(EN).length <= TITLE_MAX);

/** A listed pair's overview is indexed once PAIR_INDEX of its measures are. */
export const pairIndexed = (pair: CountryPair, measures: PairMeasure[]) =>
  pairReasons(pair.a, pair.b) !== null && measures.filter(m => pairMeasureIndexed(pair, m)).length >= PAIR_INDEX;

export function pairMeasureCopy(pair: CountryPair, m: PairMeasure, t: Translate): PlaceCopy {
  const { spec } = m;
  const f = pairFacts(m);
  const vars = (t: Translate) => {
    const { a, b } = names(pair, t);
    return {
      a, b, metric: t(spec.label), from: at(pairFrom(m)), to: at(pairTo(m)),
      ...(f && { year: at(f.year), av: formatValue(spec, f.av, t), bv: formatValue(spec, f.bv, t), lead: f.lead === 'a' ? a : b, since: at(f.since) }),
    };
  };
  const led = f && f.lead !== 'tie' && f.since !== f.from;
  return {
    title: fit(titles(pair, m), t, TITLE_MAX),
    description: fit([
      ...(led ? [(t: Translate) => t('{metric}, {a} vs {b}: {av} and {bv} in {year}; {lead} has been higher since {since}. Both charted year by year from {from}.', vars(t))] : []),
      ...(f ? [(t: Translate) => t('{metric}, {a} vs {b}: {av} and {bv} in {year}, both charted year by year from {from} to {to}, with each source.', vars(t))] : []),
      t => t('{metric} in {a} and {b} compared year by year from {from} to {to}, on one chart and in one table, with each source and what it measures.', vars(t)),
      t => t('{metric} in {a} and {b} compared year by year from {from} to {to}, on one chart and in one table, with each source.', vars(t)),
      t => t('{metric}: {a} and {b} year by year, {from} to {to}, charted with their sources.', vars(t)),
    ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
    heading: t('{a} vs {b}: {metric}', vars(t)),
    lede: pairSentences(pair, m, t).slice(0, 2).join(' '),
  };
}

/** The first and last year any of the pair's measures charts. */
export function pairSpan(measures: PairMeasure[]) {
  return { from: Math.min(...measures.map(pairFrom)), to: Math.max(...measures.map(pairTo)) };
}

export function pairOverviewCopy(pair: CountryPair, measures: PairMeasure[], t: Translate): PlaceCopy {
  const span = pairSpan(measures);
  const vars = (t: Translate) => ({ ...names(pair, t), n: measures.length, from: at(span.from), to: at(span.to) });
  const le = measures.find(m => m.spec.slug === 'life-expectancy');
  return {
    title: fit([
      t => t('{a} vs {b}: {n} measures compared since {from}', vars(t)),
      t => t('{a} vs {b}: {n} measures compared', vars(t)),
      t => t('{a} vs {b} in numbers', vars(t)),
    ], t, TITLE_MAX),
    description: fit([
      t => t('{a} and {b} compared on {n} measures, each charted year by year for both from {from} to {to}, with its source and what it measures.', vars(t)),
      t => t('{a} and {b} compared on {n} measures, each charted year by year for both from {from} to {to}, with its source.', vars(t)),
      t => t('{a} and {b} compared on {n} measures, each charted year by year for both from {from} to {to}.', vars(t)),
    ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
    heading: t('{a} vs {b}', vars(t)),
    lede: le ? t('How {a} and {b} compare on {n} measures, from {from} to {to}. The main differences:', vars(t))
      : t('How {a} and {b} compare on {n} measures, from {from} to {to}.', vars(t)),
  };
}

/** The overview's bullets, in this order where both have the measure. */
const HIGHLIGHTS = ['life-expectancy', 'gdp-per-person', 'population', 'military-spending', 'co2-per-person', 'democracy'];
const MAX_HIGHLIGHTS = 5;

/** "Life expectancy" / "In 2023, Singapore was higher: 83.7 years against 79.3 years". */
export function pairHighlights(pair: CountryPair, measures: PairMeasure[], t: Translate): { metric: string; line: string }[] {
  const { a, b } = names(pair, t);
  return HIGHLIGHTS.flatMap(slug => {
    const m = measures.find(x => x.spec.slug === slug);
    const f = m && pairFacts(m);
    if (!m || !f) return [];
    const v = (x: number) => formatValue(m.spec, x, t);
    const line = f.lead === 'tie'
      ? t('In {year}, both had {v}', { year: at(f.year), v: v(f.av) })
      : t('In {year}, {lead} was higher: {lv} against {ov}', {
        year: at(f.year), lead: f.lead === 'a' ? a : b, lv: v(f.lead === 'a' ? f.av : f.bv), ov: v(f.lead === 'a' ? f.bv : f.av),
      });
    return [{ metric: t(m.spec.label), line }];
  }).slice(0, MAX_HIGHLIGHTS);
}

/**
 * With countries beyond the pair, where they all stand in the latest year they share, highest first, or else each
 * one's latest figure: "Life expectancy in 2023, highest first: Greece: 81.9 years, Germany: 81 years and Türkiye: 77.2 years."
 */
export function groupSentence(spec: IndicatorSpec, entries: { name: string; series?: IndicatorSeries }[], t: Translate): string | undefined {
  const have = entries.flatMap(e => (e.series ? [{ name: e.name, s: e.series }] : []));
  if (!have.length) return undefined;
  const v = (x: number) => formatValue(spec, x, t);
  const metric = t(spec.label);
  const valueIn = (s: IndicatorSeries, y: number) => s.e[1][y - s.e[0]] ?? null;
  const latest = Math.min(...have.map(h => h.s.f.last[0]));
  let year = latest;
  while (year >= latest - 10 && have.some(h => valueIn(h.s, year) === null)) year--;
  if (year >= latest - 10) {
    const sorted = have.map(h => ({ name: h.name, x: valueIn(h.s, year)! })).sort((p, q) => q.x - p.x);
    return t('{metric} in {year}, highest first: {list}.', { metric, year: at(year), list: listOf(sorted.map(h => t('{place}: {v}', { place: h.name, v: v(h.x) })), t) });
  }
  return t('{metric}, latest figures: {list}.', {
    metric, list: listOf(have.map(h => t('{place}: {v} in {year}', { place: h.name, v: v(h.s.f.last[1]), year: at(h.s.f.last[0]) })), t),
  });
}

/** A comparison of more than two: its heading, which also titles it, as the page stays out of search. */
export function groupCopy(names: string[], n: number, t: Translate, spec?: IndicatorSpec): Pick<PlaceCopy, 'title' | 'heading'> & { lede?: string } {
  const list = listOf(names, t);
  const heading = spec ? t('{list}: {metric}', { list, metric: t(spec.label) }) : list;
  return { title: heading, heading, ...(!spec && { lede: t('How {list} compare on {n} measures.', { list, n }) }) };
}
