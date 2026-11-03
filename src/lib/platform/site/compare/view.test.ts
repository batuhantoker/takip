import { describe, expect, it } from 'vitest';
import { placeBySlug } from '../places/gazetteer';
import { indicatorSpec, type IndicatorSeries } from '../places/topics/indicators-data';
import { addedView, chartView, isPlainView, parseView, PLAIN_VIEW, viewQuery, withoutCountry } from './view';
import { topicTable } from '../places/tables';

// indicators.json is private (docs/data-licenses.md); a checkout without it has no measures to check.
const HAS_INDICATORS = topicTable('indicators').generated !== '';

const series = (from: number, values: (number | null)[], p?: [number, (number | null)[]]): IndicatorSeries =>
  ({ e: [from, values], ...(p && { p }), f: { n: 0, first: [from, 0], last: [from, 0], max: [from, 0], min: [from, 0] } });

describe('chartView', () => {
  const population = indicatorSpec('population')!;
  const growth = indicatorSpec('gdp-growth')!;

  it('starts every line at the view’s first year and leaves out a place with nothing after it', () => {
    const v = chartView(population, [series(1980, [1, 2, 3, 4]), series(1980, [5, null, null, null]), undefined], undefined, { ...PLAIN_VIEW, from: 1982 });
    expect(v.places[0]?.e).toEqual([1982, [3, 4]]);
    expect(v.places[1]).toBeUndefined();
    expect(v.places[2]).toBeUndefined();
  });

  it('charts a level’s change in percent since the first year all have, the World with them', () => {
    const v = chartView(population, [series(2000, [null, 10, 20]), series(2000, [4, 5, 10])], { e: [2000, [40, 80, 120]] }, { ...PLAIN_VIEW, change: true, world: true });
    expect(v.change).toEqual({ base: 2001, relative: true });
    expect(v.places.map(s => s?.e)).toEqual([[2000, [null, 0, 100]], [2000, [-20, 0, 100]]]);
    expect(v.world?.e).toEqual([2000, [-50, 0, 50]]);
  });

  it('charts any other measure’s change in its own unit, below zero too, and never on a log axis', () => {
    const v = chartView(growth, [series(2000, [2, -1]), series(2000, [3, 4])], undefined, { ...PLAIN_VIEW, change: true, log: true });
    expect(v.change).toEqual({ base: 2000, relative: false });
    expect(v.places.map(s => s?.e)).toEqual([[2000, [0, -3]], [2000, [0, 1]]]);
    expect([v.log, v.can.log]).toEqual([false, false]);
    expect(chartView(population, [series(2000, [1, 2])], undefined, { ...PLAIN_VIEW, log: true })).toMatchObject({ log: true, can: { log: true } });
    expect(chartView(population, [series(2000, [1, null]), series(2000, [null, 2])], undefined, { ...PLAIN_VIEW, change: true }).can.change).toBe(false);
  });

  it('leaves the World out beside a total unless asked, and draws it beside a rate unless told not to', () => {
    const world = { e: [2000, [100, 200]] as [number, number[]] };
    const one = [series(2000, [1, 2])];
    expect(chartView(population, one, world, PLAIN_VIEW).world).toBeUndefined();
    expect(chartView(population, one, world, { ...PLAIN_VIEW, world: true }).world).toBeDefined();
    expect(chartView(indicatorSpec('life-expectancy')!, one, world, PLAIN_VIEW).world).toBeDefined();
    expect(chartView(indicatorSpec('life-expectancy')!, one, world, { ...PLAIN_VIEW, world: false }).world).toBeUndefined();
  });

  it('drops projections when asked', () => {
    const v = chartView(population, [series(2000, [1, 2], [2002, [3, 4]])], undefined, { ...PLAIN_VIEW, proj: false });
    expect(v.places[0]?.p).toBeUndefined();
  });
});

describe('the view in the query', () => {
  const [greece, turkey, germany, cyprus] = ['greece', 'turkey', 'germany', 'cyprus'].map(s => placeBySlug('country', s));

  it.skipIf(!HAS_INDICATORS)('reads what it can and writes it back the same', () => {
    if (!greece || !turkey || !germany || !cyprus) return;
    const pair = { a: greece, b: turkey };
    const v = parseView({ with: 'germany,greece,nowhere,cyprus,germany', from: '1990', log: '1', world: '0' }, pair);
    expect(v.with.map(p => p.slug)).toEqual(['germany', 'cyprus']);
    expect(viewQuery(v)).toBe('?with=germany,cyprus&from=1990&log=1&world=0');
    expect(viewQuery(parseView({ world: '1' }, pair))).toBe('?world=1');
    expect(parseView({ world: 'yes' }, pair).world).toBeUndefined();
    expect(parseView({ from: '1977' }, pair).from).toBeUndefined();
    expect(isPlainView(parseView({}, pair))).toBe(true);
    expect(addedView(cyprus, pair, parseView({ with: 'germany' }, pair))?.with.map(p => p.slug)).toEqual(['germany', 'cyprus']);
    expect(addedView(turkey, pair, PLAIN_VIEW)).toBeUndefined();
    expect(addedView(undefined, pair, PLAIN_VIEW)).toBeUndefined();
  });

  it('gives a pair’s place to the first added country when one of the two is taken off', () => {
    if (!greece || !turkey || !germany || !cyprus) return;
    const pair = { a: greece, b: turkey };
    const view = { ...PLAIN_VIEW, with: [germany, cyprus] };
    expect(withoutCountry(pair, view, germany.id)?.view.with).toEqual([cyprus]);
    const off = withoutCountry(pair, view, greece.id)!;
    expect([off.pair.a.slug, off.pair.b.slug, off.view.with.map(p => p.slug)]).toEqual(['germany', 'turkey', ['cyprus']]);
    expect(withoutCountry(pair, PLAIN_VIEW, greece.id)).toBeUndefined();
  });
});
