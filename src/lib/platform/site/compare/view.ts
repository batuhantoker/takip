import { SERIES_INK } from '@/lib/map/style/tokens';
import { placeBySlug } from '../places/gazetteer';
import type { Place } from '../places/place';
import type { IndicatorSeries, IndicatorSpec, Yearly } from '../places/topics/indicators-data';
import { indicatorRow } from '../places/topics/indicators-table';
import { pairSlug, type CountryPair } from './pairs';

/**
 * What a reader changed on a comparison, kept in its query so it is remembered and can be shared: more countries
 * (?with=germany,france), the years from (?from=1990), the change since the first year all of them have (?change=1), a
 * log axis (?log=1), the World's line hidden or shown (?world=0, ?world=1: a total's is off unless asked) and the
 * projections hidden (?proj=0). A page with any of them is the reader's own, kept out of search; the pair's plain page
 * stays the one indexed.
 */

/** One colour each. */
export const MAX_COUNTRIES = SERIES_INK.length;

export interface CompareView {
  /** Countries beyond the pair, in the order they were added. */
  with: Place[];
  from?: number;
  change: boolean;
  log: boolean;
  /** Undefined for the measure's own default. */
  world?: boolean;
  proj: boolean;
}

export const PLAIN_VIEW: CompareView = { with: [], change: false, log: false, proj: true };

/** The years a reader can start a chart from, where the chart reaches back past them. */
export const FROM_YEARS = [1950, 1990, 2010];

/** Measures that grow or shrink by multiples, whose change reads as a percentage; any other's is in its own unit. */
const RELATIVE = new Set([
  'population', 'gdp-per-person', 'military-spending-in-dollars', 'military-spending-per-person', 'armed-forces', 'co2-per-person',
  'child-mortality', 'infant-mortality',
]);

export type Query = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function countries(slugs: string, pair: CountryPair): Place[] {
  const taken = new Set([pair.a.id, pair.b.id]);
  return slugs.split(',').flatMap(slug => {
    const p = placeBySlug('country', slug.trim());
    if (!p || taken.has(p.id) || !indicatorRow(p.id)) return [];
    taken.add(p.id);
    return [p];
  }).slice(0, MAX_COUNTRIES - 2);
}

export function parseView(q: Query, pair: CountryPair): CompareView {
  const from = Number(one(q.from));
  return {
    with: countries(one(q.with) ?? '', pair),
    ...(FROM_YEARS.includes(from) && { from }),
    change: one(q.change) === '1',
    log: one(q.log) === '1',
    ...(['0', '1'].includes(one(q.world) ?? '') && { world: one(q.world) === '1' }),
    proj: one(q.proj) !== '0',
  };
}

/** The view with a country added (from ?add=), or undefined where it adds nothing. */
export function addedView(place: Place | undefined, pair: CountryPair, view: CompareView): CompareView | undefined {
  const added = countries([...view.with.map(p => p.slug), place?.slug ?? ''].join(','), pair);
  return added.length > view.with.length ? { ...view, with: added } : undefined;
}

/** "?with=germany&log=1", or '' for the plain page. */
export function viewQuery(v: CompareView): string {
  const q = new URLSearchParams();
  if (v.with.length) q.set('with', v.with.map(p => p.slug).join(','));
  if (v.from !== undefined) q.set('from', String(v.from));
  if (v.change) q.set('change', '1');
  if (v.log) q.set('log', '1');
  if (v.world !== undefined) q.set('world', v.world ? '1' : '0');
  if (!v.proj) q.set('proj', '0');
  const s = q.toString().replaceAll('%2C', ',');
  return s ? `?${s}` : '';
}

export const isPlainView = (v: CompareView) => viewQuery(v) === '';

/**
 * The pair and view left once a country is taken off: an added one simply goes, and one of the pair gives its place
 * to the first added. Undefined where only two are left.
 */
export function withoutCountry(pair: CountryPair, view: CompareView, id: number): { pair: CountryPair; view: CompareView } | undefined {
  if (view.with.some(p => p.id === id)) return { pair, view: { ...view, with: view.with.filter(p => p.id !== id) } };
  const [next, ...rest] = view.with;
  if (!next) return undefined;
  const kept = pair.a.id === id ? pair.b : pair.a;
  const [a, b] = pairSlug(kept, next).startsWith(kept.slug) ? [kept, next] : [next, kept];
  return { pair: { a, b }, view: { ...view, with: rest } };
}

/** Each added country's series for a measure, or undefined where it has none. */
export const extraSeries = (view: CompareView, slug: string) => view.with.map(p => indicatorRow(p.id)?.m[slug]);

function clip(y: Yearly | undefined, from: number | undefined): Yearly | undefined {
  if (!y || from === undefined || y[0] >= from) return y;
  const values = y[1].slice(from - y[0]);
  return values.some(v => v !== null) ? [from, values] : undefined;
}

const mapped = (y: Yearly | undefined, f: (v: number) => number): Yearly | undefined => y && [y[0], y[1].map(v => (v === null ? null : f(v)))];

const valueIn = (y: Yearly | undefined, year: number) => (y ? y[1][year - y[0]] ?? null : null);

type Lines = { e: Yearly; l?: Yearly; m?: Yearly; p?: Yearly; lo?: Yearly; hi?: Yearly };

function shown<T extends Lines>(s: T, view: CompareView): T {
  const out = { ...s, e: clip(s.e, view.from) ?? [view.from ?? s.e[0], []], l: clip(s.l, view.from), m: clip(s.m, view.from) };
  return view.proj ? { ...out, p: clip(s.p, view.from), lo: clip(s.lo, view.from), hi: clip(s.hi, view.from) } : { ...out, p: undefined, lo: undefined, hi: undefined };
}

const valuesOf = (s: Lines) => [s.e, s.l, s.m, s.p, s.lo, s.hi].flatMap(y => (y ? y[1].filter((v): v is number => v !== null) : []));

export interface ChartView {
  /** Each place's series as drawn, in the order given; undefined where it has nothing in the years shown. */
  places: (IndicatorSeries | undefined)[];
  world?: { e: Yearly; p?: Yearly };
  /** Whether the World's line is asked for, before the years shown may leave it out. */
  worldShown: boolean;
  /** Each line as its change since `base`, the first year all have: in percent where `relative`, else in the unit. */
  change?: { base: number; relative: boolean };
  log: boolean;
  /** Whether these lines can be drawn on a log axis or as their change at all. */
  can: { log: boolean; change: boolean };
}

/**
 * The places' and the World's series as the view draws them: from its first year, with or without projections, and
 * as their change since the first year all of them have where asked.
 */
export function chartView(spec: IndicatorSpec, places: (IndicatorSeries | undefined)[], world: { e: Yearly; p?: Yearly } | undefined, view: CompareView): ChartView {
  const cut = places.map(s => (s ? shown(s, view) : undefined)).map(s => (s?.e[1].some(v => v !== null) ? s : undefined));
  const worldShown = view.world ?? !spec.total;
  const sky = worldShown && world ? shown(world, view) : undefined;
  const drawn = cut.filter((s): s is IndicatorSeries => !!s);
  const sets = drawn.map(s => new Set(s.e[1].flatMap((v, i) => (v === null ? [] : [s.e[0] + i]))));
  const relative = RELATIVE.has(spec.slug);
  const usable = (v: number | null) => v !== null && (!relative || v > 0);
  const base = [...(sets[0] ?? [])].sort((x, y) => x - y).find(y => sets.every(set => set.has(y)) && drawn.every(s => usable(valueIn(s.e, y))));
  const can = {
    log: drawn.length > 0 && [...drawn, ...(sky ? [sky] : [])].every(s => valuesOf(s).every(v => v > 0)),
    change: base !== undefined,
  };
  if (!view.change || base === undefined) return { places: cut, world: sky, worldShown, log: view.log && can.log, can };
  const since = <T extends Lines>(s: T): T => {
    const b = valueIn(s.e, base)!;
    const f = relative ? (v: number) => ((v - b) / b) * 100 : (v: number) => v - b;
    return { ...s, e: mapped(s.e, f)!, l: mapped(s.l, f), m: mapped(s.m, f), p: mapped(s.p, f), lo: mapped(s.lo, f), hi: mapped(s.hi, f) };
  };
  // A change runs either side of zero, which a log axis can't draw.
  const changed = { places: cut.map(s => s && since(s)), worldShown, change: { base, relative }, log: false, can: { ...can, log: false } };
  return usable(valueIn(sky?.e, base)) ? { ...changed, world: since(sky!) } : changed;
}
