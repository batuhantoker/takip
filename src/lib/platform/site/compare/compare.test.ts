import { describe, expect, it } from 'vitest';
import { EN } from '../places/copy/format';
import { placeBySlug } from '../places/gazetteer';
import type { Place } from '../places/place';
import type { IndicatorSeries } from '../places/topics/indicators-data';
import { commonYears, comparePath, pairFacts, pairFocus, pairMeasures } from './compare';
import { pairAnswer, pairHighlights, pairIndexed, pairMeasureCopy, pairMeasureIndexed, pairOverviewCopy, pairSentences, pairTurns, sideBySide } from './compare-copy';
import { nextMeasures, nextPairs } from './next';
import { listedPairs, pairReasons } from './pairs';
import { worldCopy, worldMeasure, worldSlugs } from './world';
import { topicTable } from '../places/tables';

// indicators.json is private (docs/data-licenses.md); a checkout without it has no measures to check.
const HAS_INDICATORS = topicTable('indicators').generated !== '';

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

const country = (lon: number, lat: number, area: number) => ({ id: lon * 1000 + lat, kind: 'country', slug: 'x', name: 'X', cc: 'XX', at: [lon, lat], pop: 1, area }) as Place;

describe('pairFocus', () => {
  it('frames two neighbours between them, closer for small ones', () => {
    const balkans = pairFocus([country(25.2, 42.7, 111_000), country(21.7, 41.6, 25_700)])!;
    expect(balkans.lon).toBeGreaterThan(21.7);
    expect(balkans.lon).toBeLessThan(25.2);
    expect(balkans.zoom).toBeGreaterThanOrEqual(5);
    const big = pairFocus([country(22, 39, 132_000), country(35, 39, 784_000)])!;
    expect(big.zoom).toBeLessThan(balkans.zoom);
  });

  it('frames a pair across the antimeridian the short way, and none too far apart', () => {
    const pacific = pairFocus([country(178, -17.8, 18_000), country(-175.2, -21.2, 750)])!;
    expect(Math.abs(pacific.lon)).toBeGreaterThan(175);
    expect(pairFocus([country(-98, 39, 9_800_000), country(104, 35, 9_600_000)])).toBeUndefined();
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

  it('answers with both figures in the year they share, who is higher and by how much', () => {
    if (!greece || !turkey) return;
    const pair = { a: greece, b: turkey };
    const pop = pairMeasures(pair).find(m => m.spec.slug === 'population');
    if (!pop) return;
    const answer = pairAnswer(pair, pop, EN);
    expect(answer.tiles.map(t => t.name)).toEqual(['Greece', 'Türkiye']);
    expect(answer.tiles[1]).toMatchObject({ before: '', after: ' people' });
    expect(answer.tiles[0].note).toMatch(/^\d{4} · UN estimates$/);
    expect(answer.verdict).toMatch(/^Higher in Türkiye by [\d.]+ million people: [\d.]+ times the figure for Greece\.$/);
    expect(answer.since).toMatch(/^Türkiye has been higher/);
  });

  it('leads the overview with the measures where one figure is the most times the other', () => {
    if (!greece || !turkey) return;
    const pair = { a: greece, b: turkey };
    const measures = pairMeasures(pair);
    if (!measures.length) return;
    const points = pairHighlights(pair, measures, EN);
    expect(points.length).toBeGreaterThanOrEqual(3);
    expect(points[0].line).toMatch(/^[\d.]+ times as high in (Greece|Türkiye): .+ in \d{4}$/);
    const times = points.map(p => Number(/^([\d.]+) times/.exec(p.line)?.[1] ?? 0));
    expect(times).toEqual([...times].sort((x, y) => y - x));
  });

  it('sets both figures side by side, as times only where that means something', () => {
    if (!greece || !turkey) return;
    const measures = pairMeasures({ a: greece, b: turkey });
    const pop = measures.find(m => m.spec.slug === 'population');
    if (pop) expect(sideBySide(pop, EN)).toMatchObject({ lead: 'b', ratio: expect.stringMatching(/^[\d.]+$/) });
    const temp = measures.find(m => m.spec.slug === 'temperature');
    if (temp) expect(sideBySide(temp, EN).ratio).toBeUndefined();
  });

  it('tells the latest changes of lead, newest first, leaving out measures that flip most years', () => {
    if (!greece || !turkey) return;
    const pair = { a: greece, b: turkey };
    const turns = pairTurns(pair, pairMeasures(pair), EN);
    for (const turn of turns) expect(turn.line).toMatch(/^(Greece|Türkiye) has been higher since \d{4}, when it overtook (Greece|Türkiye)\.$/);
    const years = turns.map(turn => Number(/since (\d{4})/.exec(turn.line)![1]));
    expect(years).toEqual([...years].sort((x, y) => y - x));
    expect(turns.map(turn => turn.slug)).not.toContain('gdp-growth');
  });

  it.skipIf(!HAS_INDICATORS)('leads on to listed pairs sharing a country, and the pair’s other measures', () => {
    if (!greece || !turkey) return;
    const pair = { a: greece, b: turkey };
    const next = nextPairs(pair, 'population');
    expect(next.length).toBeGreaterThan(0);
    for (const p of next) {
      expect([greece.id, turkey.id]).toContain(p.a.id);
      expect([greece.id, turkey.id]).not.toContain(p.b.id);
      expect(pairReasons(p.a, p.b)).not.toBeNull();
    }
    const measures = nextMeasures(pairMeasures(pair), 'population');
    expect(measures.map(m => m.spec.slug)).not.toContain('population');
    expect(measures[0].spec.slug).toBe('life-expectancy');
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
