import type { Translate } from '@/lib/core/i18n/translator';
import { DESCRIPTION_RANGE, EN, fit, listOf, nameOf, TITLE_MAX } from '../places/copy/format';
import type { PlaceCopy } from '../places/topic';
import { basisOf, formatNumber, formatValue, projectionName } from '../places/topics/indicators-facts';
import type { IndicatorSeries, IndicatorSpec } from '../places/topics/indicators-data';
import { PAIR_INDEX, pairFacts, pairMeasures, type Lead, type PairFacts, type PairMeasure } from './compare';
import { searchScope } from '../search-scope';
import { pairReasons, type CountryPair } from './pairs';

/**
 * What a comparison says, every sentence from the two countries' own series: each one's latest value, the gap and
 * ratio in the latest year both have, who has been higher since when, their ranks and projections.
 */

const at = (y: number) => String(y);

/** "1.06", "12": a ratio to two significant digits past ten. */
const ratioOf = (x: number, y: number, t: Translate) =>
  new Intl.NumberFormat(t.intl, { maximumSignificantDigits: Math.max(x, y) / Math.min(x, y) >= 10 ? 2 : 3 }).format(Math.max(x, y) / Math.min(x, y));

// The gap between two shares is in percentage points, not a share itself.
const gapOf = (spec: IndicatorSpec, f: PairFacts, t: Translate) => (spec.value.includes('%')
  ? t('{v} percentage points', { v: formatNumber(Math.abs(f.av - f.bv), spec.style, spec.digits, t) })
  : formatValue(spec, Math.abs(f.av - f.bv), t));

function names(pair: CountryPair, t: Translate) {
  return { a: nameOf(pair.a, t), b: nameOf(pair.b, t) };
}

/** The first year either country's line on the chart starts. */
export const pairFrom = (m: PairMeasure) => Math.min(m.a.f.first[0], m.b.f.first[0]);
export const pairTo = (m: PairMeasure) => Math.max(m.a.f.last[0], m.b.f.last[0]);

/** Who has been higher since when, over the years both have; undefined for a tie. */
function sinceSentence(f: PairFacts, a: string, b: string, t: Translate): string | undefined {
  if (f.lead === 'tie') return undefined;
  const lead = f.lead === 'a' ? a : b;
  const other = f.lead === 'a' ? b : a;
  if (f.since === f.from) return t('{lead} has been higher in every year both have figures for since {from}.', { lead, from: at(f.from) });
  if (f.before && f.before !== 'tie') return t('{lead} has been higher since {since}, when it overtook {other}.', { lead, other, since: at(f.since) });
  return t('{lead} has been higher since {since}.', { lead, since: at(f.since) });
}

/** A comparison's sentences by role: the latest values, the gap in the latest year both have, since when, then the rest. */
export function pairParts(pair: CountryPair, m: PairMeasure, t: Translate): { values: string; gap?: string; since?: string; rest: string[] } {
  const { spec, a: sa, b: sb } = m;
  const { a, b } = names(pair, t);
  const v = (x: number) => formatValue(spec, x, t);
  const basis = { basis: basisOf(spec), by: spec.by, metric: t(spec.label) };
  const values = sa.f.last[0] === sb.f.last[0]
    ? t('{metric} in {year}: {av} in {a} and {bv} in {b}, {basis, select, modelled {in the {by} climate models’ median run} observed {by {by} observations} other {by {by} estimates}}.', {
      ...basis, year: at(sa.f.last[0]), av: v(sa.f.last[1]), bv: v(sb.f.last[1]), a, b,
    })
    : t('{metric}: {av} in {a} in {ay} and {bv} in {b} in {byear}, {basis, select, modelled {in the {by} climate models’ median run} observed {by {by} observations} other {by {by} estimates}}.', {
      ...basis, av: v(sa.f.last[1]), ay: at(sa.f.last[0]), bv: v(sb.f.last[1]), byear: at(sb.f.last[0]), a, b,
    });
  const f = pairFacts(m);
  let gap: string | undefined;
  if (f?.lead === 'tie') gap = t('In {year} both had {v}.', { year: at(f.year), v: v(f.av) });
  else if (f) {
    const lead = f.lead === 'a' ? a : b;
    const other = f.lead === 'a' ? b : a;
    gap = f.av > 0 && f.bv > 0
      ? t('In {year} the value was higher in {lead}, by {gap}, or {ratio} times that in {other}.', { year: at(f.year), lead, other, gap: gapOf(spec, f, t), ratio: ratioOf(f.av, f.bv, t) })
      : t('In {year} the value was higher in {lead}, by {gap}.', { year: at(f.year), lead, gap: gapOf(spec, f, t) });
  }
  const rest: string[] = [];
  const ry = m.meta?.rankYear;
  if (ry !== undefined && sa.f.rank?.length === 2 && sb.f.rank?.length === 2) {
    rest.push(t('In {year}, {a} ranked {ra} and {b} ranked {rb} of {n} countries, counting from the highest.', { year: at(ry), a, b, ra: sa.f.rank[0], rb: sb.f.rank[0], n: sa.f.rank[1] }));
  }
  if (spec.projection) {
    const projection = projectionName(spec.projection, t);
    const pa = sa.f.proj;
    const pb = sb.f.proj;
    if (pa && pb && pa[0] === pb[0]) rest.push(t('The {projection} puts {a} at {pa} and {b} at {pb} in {year}.', { projection, a, b, pa: v(pa[1]), pb: v(pb[1]), year: at(pa[0]) }));
    else {
      for (const [place, p] of [[a, pa], [b, pb]] as const) {
        if (p) rest.push(t('The {projection} puts {place} at {v} in {year}.', { projection, place, v: v(p[1]), year: at(p[0]) }));
      }
    }
  }
  const world = m.meta?.world;
  const wy = f?.year;
  const wv = world && wy !== undefined ? world.e[1][wy - world.e[0]] : null;
  if (wv != null && wy !== undefined) rest.push(t('The world as a whole: {v} in {year}.', { v: v(wv), year: at(wy) }));
  return { values, gap, since: f && sinceSentence(f, a, b, t), rest };
}

export function pairSentences(pair: CountryPair, m: PairMeasure, t: Translate): string[] {
  const p = pairParts(pair, m, t);
  return [p.values, ...(p.gap ? [p.gap] : []), ...(p.since ? [p.since] : []), ...p.rest];
}

/** Below this, "1.02 times" says nothing the gap doesn't. */
const RATIO_WORTH = 1.2;

/** A figure as it is shown, to `digits` places, halves away from zero as Intl rounds them (0.865 is 0.87, not toFixed's 0.86). */
const shown = (v: number, digits: number) => (Math.sign(v) * Math.round(Number((Math.abs(v) * 10 ** digits).toPrecision(12)))) / 10 ** digits;

/** Rates of change and degrees Celsius, of which "times as high" means nothing. */
const NO_RATIO = new Set(['population-growth', 'gdp-growth', 'inflation', 'net-migration', 'temperature']);

/** How many times the higher figure is the lower, where both are above zero as shown and it says more than the gap. */
function timesOf(spec: IndicatorSpec, { av, bv }: Pick<PairFacts, 'av' | 'bv'>): number | undefined {
  const low = Math.min(av, bv);
  if (NO_RATIO.has(spec.slug) || low <= 0 || shown(low, spec.digits) === 0) return undefined;
  const r = Math.max(av, bv) / low;
  return r >= RATIO_WORTH ? r : undefined;
}

/** A row of the side-by-side table: both figures, in the latest year both have where they share one. */
export interface SideBySide {
  a: [year: number, v: number];
  b: [year: number, v: number];
  /** Who is higher, said only where both figures are for one year. */
  lead?: Lead;
  /** "1.84", where the higher is that many times the lower; else the gap. */
  ratio?: string;
  gap?: number;
}

export function sideBySide(m: Pick<PairMeasure, 'spec' | 'a' | 'b' | 'common'>, t: Translate): SideBySide {
  const f = pairFacts(m);
  if (!f) return { a: m.a.f.last, b: m.b.f.last };
  const side = { a: [f.year, f.av], b: [f.year, f.bv] } satisfies Pick<SideBySide, 'a' | 'b'>;
  if (timesOf(m.spec, f)) return { ...side, lead: f.lead, ratio: ratioOf(f.av, f.bv, t) };
  // The gap between the figures as shown, so 83.3 and 81.4 differ by 1.9 rather than a rounded 2, and 0.4 and 0.4 by nothing.
  const gap = Math.abs(shown(f.av, m.spec.digits) - shown(f.bv, m.spec.digits));
  return gap ? { ...side, lead: f.lead, gap } : { ...side, lead: 'tie' };
}

/** One country's figure in the answer, split so the number can stand out from its unit: "6.8 million" and " people". */
export interface AnswerTile { slot: 0 | 1; name: string; before: string; number: string; after: string; note: string }

/**
 * The answer at the top of a measure's comparison: both countries' figures in the latest year they share (else each
 * one's latest), who is higher and by how much, and since when.
 */
export function pairAnswer(pair: CountryPair, m: PairMeasure, t: Translate): { tiles: AnswerTile[]; verdict?: string; since?: string } {
  const { spec } = m;
  const { a, b } = names(pair, t);
  const f = pairFacts(m);
  const mark = '\u0000';
  const basisName = t('{basis, select, modelled {{by} model median} observed {{by} observations} other {{by} estimates}}', { basis: basisOf(spec), by: spec.by });
  const tile = (slot: 0 | 1, name: string, [year, x]: [number, number]): AnswerTile => {
    const parts = t(spec.value, { v: mark }).split(mark);
    const note = `${at(year)} · ${basisName}`;
    return parts.length === 2
      ? { slot, name, before: parts[0], number: formatNumber(x, spec.style, spec.digits, t), after: parts[1], note }
      : { slot, name, before: '', number: formatValue(spec, x, t), after: '', note };
  };
  const tiles = [
    tile(0, a, f ? [f.year, f.av] : m.a.f.last),
    tile(1, b, f ? [f.year, f.bv] : m.b.f.last),
  ];
  if (!f) return { tiles };
  if (f.lead === 'tie') return { tiles, verdict: t('In {year} both had {v}.', { year: at(f.year), v: formatValue(spec, f.av, t) }) };
  const lead = f.lead === 'a' ? a : b;
  const other = f.lead === 'a' ? b : a;
  const verdict = timesOf(spec, f)
    ? t('Higher in {lead} by {gap}: {ratio} times the figure for {other}.', { lead, other, gap: gapOf(spec, f, t), ratio: ratioOf(f.av, f.bv, t) })
    : t('Higher in {lead} by {gap}.', { lead, gap: gapOf(spec, f, t) });
  return { tiles, verdict, since: sinceSentence(f, a, b, t) };
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

/** Whether a pair's page (its overview without a measure), as it first opens, is put forward for search. */
export function compareIndexed(pair: CountryPair, measure?: string): boolean {
  if (!searchScope('/compare')) return false;
  const measures = pairMeasures(pair);
  if (measure === undefined) return pairIndexed(pair, measures);
  const m = measures.find(x => x.spec.slug === measure);
  return !!m && pairMeasureIndexed(pair, m);
}

export function pairMeasureCopy(pair: CountryPair, m: PairMeasure, t: Translate): PlaceCopy {
  const { spec } = m;
  const f = pairFacts(m);
  const { values, gap } = pairParts(pair, m, t);
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
    lede: gap ? `${values} ${gap}` : values,
  };
}

/** The first and last year any of the pair's measures charts. */
export function pairSpan(measures: PairMeasure[]) {
  return { from: Math.min(...measures.map(pairFrom)), to: Math.max(...measures.map(pairTo)) };
}

export function pairOverviewCopy(pair: CountryPair, measures: PairMeasure[], t: Translate): PlaceCopy {
  const span = pairSpan(measures);
  const vars = (t: Translate) => ({ ...names(pair, t), n: measures.length, from: at(span.from), to: at(span.to) });
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
    lede: pairHighlights(pair, measures, t).length ? t('How {a} and {b} compare on {n} measures. The main differences:', vars(t))
      : t('How {a} and {b} compare on {n} measures.', vars(t)),
  };
}

/** The measures people look at first, for the pair's next links and to make up the overview's bullets. */
export const HIGHLIGHTS = ['life-expectancy', 'gdp-per-person', 'population', 'military-spending', 'co2-per-person', 'democracy'];
const MAX_HIGHLIGHTS = 5;
const MIN_HIGHLIGHTS = 3;

/**
 * Where the overview looks for the pair's main differences: measures read at a glance. Totals other than population
 * are left out, as they mostly repeat the difference in size.
 */
const DIFFERENCES = new Set([
  'population', 'gdp-per-person', 'life-expectancy', 'median-age', 'fertility-rate', 'child-mortality', 'people-aged-65-and-over',
  'government-debt', 'military-spending', 'military-spending-per-person', 'co2-per-person', 'democracy', 'human-rights',
  'internet-users', 'urban-population', 'forest-area', 'electricity-access', 'safe-drinking-water',
]);

/**
 * The overview's bullets: the measures where one figure is the most times the other, then the ones people look at
 * first while there are fewer than three. "Government debt" / "1.84 times as high in France: 115.5% of GDP against 62.7% of GDP in 2025".
 */
export function pairHighlights(pair: CountryPair, measures: PairMeasure[], t: Translate): { slug: string; metric: string; line: string }[] {
  const { a, b } = names(pair, t);
  const facts = measures.flatMap(m => {
    const f = pairFacts(m);
    return f ? [{ m, f, times: timesOf(m.spec, f) }] : [];
  });
  const differ = facts.filter(x => x.times && DIFFERENCES.has(x.m.spec.slug)).sort((x, y) => y.times! - x.times!).slice(0, MAX_HIGHLIGHTS);
  const fill = HIGHLIGHTS.flatMap(slug => facts.filter(x => x.m.spec.slug === slug && !differ.includes(x))).slice(0, Math.max(0, MIN_HIGHLIGHTS - differ.length));
  return [...differ, ...fill].map(({ m, f, times }) => {
    const v = (x: number) => formatValue(m.spec, x, t);
    const vars = { year: at(f.year), lead: f.lead === 'a' ? a : b, lv: v(f.lead === 'a' ? f.av : f.bv), ov: v(f.lead === 'a' ? f.bv : f.av) };
    const line = f.lead === 'tie' ? t('In {year}, both had {v}', { year: at(f.year), v: v(f.av) })
      : times ? t('{ratio} times as high in {lead}: {lv} against {ov} in {year}', { ...vars, ratio: ratioOf(f.av, f.bv, t) })
        : t('In {year}, {lead} was higher: {lv} against {ov}', vars);
    return { slug: m.spec.slug, metric: t(m.spec.label), line };
  });
}

/** Measures whose lead flips most years, where an overtake is noise rather than news. */
const VOLATILE = new Set(['population-growth', 'gdp-growth', 'inflation', 'net-migration', 'conflict-deaths', 'arms-imports', 'arms-exports']);
const MAX_TURNS = 4;
/** How long ago an overtake is still worth telling. */
const TURN_YEARS = 30;

/** The pair's latest changes of lead, newest first: "Military spending" / "Germany has been higher since 2025, when it overtook France." */
export function pairTurns(pair: CountryPair, measures: PairMeasure[], t: Translate): { slug: string; metric: string; line: string }[] {
  const { a, b } = names(pair, t);
  return measures.flatMap(m => {
    const f = pairFacts(m);
    const turned = f && f.lead !== 'tie' && f.before && f.before !== 'tie' && f.year - f.since <= TURN_YEARS && !VOLATILE.has(m.spec.slug);
    return turned ? [{ m, f }] : [];
  }).sort((x, y) => y.f.since - x.f.since).slice(0, MAX_TURNS)
    .map(({ m, f }) => ({ slug: m.spec.slug, metric: t(m.spec.label), line: sinceSentence(f, a, b, t)! }));
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
