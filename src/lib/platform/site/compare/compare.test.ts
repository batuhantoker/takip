import { describe, expect, it } from 'vitest';
import { EN } from '../places/copy/format';
import { placeBySlug } from '../places/gazetteer';
import type { IndicatorSeries } from '../places/topics/indicators-data';
import { commonYears, comparePath, pairFacts, pairMeasures } from './compare';
import { pairIndexed, pairMeasureCopy, pairMeasureIndexed, pairOverviewCopy, pairSentences } from './compare-copy';
import { listedPairs } from './pairs';
import { worldCopy, worldMeasure, worldSlugs } from './world';

const series = (from: number, values: (number | null)[]): IndicatorSeries =>
  ({ e: [from, values], f: { n: 0, first: [from, 0], last: [from, 0], max: [from, 0], min: [from, 0] } });

describe('pairFacts', () => {
  it('finds the leader in the latest year both have, since when, and who led before', () => {
    const a = series(2000, [1, 2, 5, 6, null, 9]);
    const b = series(2001, [3, 4, 5, 8, 7]);
    const common = commonYears(a.e, b.e);
    expect(common).toEqual([2001, 2002, 2003, 2005]);
    expect(pairFacts({ a, b, common })).toEqual({ year: 2005, av: 9, bv: 7, lead: 'a', since: 2002, before: 'b', from: 2001 });
  });

  it('runs the lead back to the first common year when it never changed', () => {
    const a = series(2000, [5, 6, 7]);
    const b = series(2000, [1, 2, 3]);
    expect(pairFacts({ a, b, common: commonYears(a.e, b.e) })).toMatchObject({ lead: 'a', since: 2000, from: 2000 });
    expect(pairFacts({ a, b: series(1990, [1]), common: [] })).toBeUndefined();
  });
});

describe('a real pair', () => {
  const greece = placeBySlug('country', 'greece');
  const turkey = placeBySlug('country', 'turkey');

  it('says who is higher and by how much, gaps in shares in percentage points', () => {
    if (!greece || !turkey) return;
    const pair = { a: greece, b: turkey };
    const measures = pairMeasures(pair);
    if (!measures.length) return;
    expect(comparePath(pair, 'life-expectancy')).toBe('/compare/greece-vs-turkey/life-expectancy');
    expect(pairIndexed(pair, measures)).toBe(true);
    const le = measures.find(m => m.spec.slug === 'life-expectancy')!;
    expect(pairSentences(pair, le, EN)[0]).toMatch(/^Life expectancy in 2023: [\d.]+ years in Greece and [\d.]+ years in Türkiye, by UN estimates\.$/);
    const milex = measures.find(m => m.spec.slug === 'military-spending');
    if (milex) expect(pairSentences(pair, milex, EN)[1]).toMatch(/percentage points/);
  });
});

// Every comparison and world page search engines are told about, with the copy it would show.
const listed = listedPairs().flatMap(pair => {
  const measures = pairMeasures(pair);
  return [
    ...(pairIndexed(pair, measures) ? [{ key: comparePath(pair), copy: pairOverviewCopy(pair, measures, EN) }] : []),
    ...measures.filter(m => pairMeasureIndexed(pair, m)).map(m => ({ key: comparePath(pair, m.spec.slug), copy: pairMeasureCopy(pair, m, EN) })),
  ];
});
const world = worldSlugs().flatMap(slug => {
  const w = worldMeasure(slug);
  return w ? [{ key: slug, copy: worldCopy(w, EN) }] : [];
});

describe('indexed comparison and world pages', () => {
  const pages = [...listed, ...world];

  it('keep every title within 60 characters', () => {
    expect(pages.filter(p => p.copy.title.length > 60).map(p => p.copy.title)).toEqual([]);
  });

  it('keep every description between 110 and 160 characters', () => {
    expect(pages.filter(p => p.copy.description.length < 110 || p.copy.description.length > 160).map(p => p.copy.description)).toEqual([]);
  });

  it('give every page its own title', () => {
    const seen = new Set<string>();
    expect(pages.filter(p => (seen.has(p.copy.title) ? true : (seen.add(p.copy.title), false))).map(p => p.copy.title)).toEqual([]);
  });
});
