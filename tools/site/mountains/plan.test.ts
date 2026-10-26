import { describe, expect, it } from 'vitest';
import { term } from './fetch';
import { assignSlugs, baseSlug, emptyLedger, isIndexed, kindOf, namesFor, pickMetres, unqualified, type SlugInput } from './plan';

const PREFERRED = 'http://wikiba.se/ontology#PreferredRank';
const NORMAL = 'http://wikiba.se/ontology#NormalRank';
const DEPRECATED = 'http://wikiba.se/ontology#DeprecatedRank';

describe('pickMetres', () => {
  it('takes the preferred statement over the others', () => {
    expect(pickMetres([
      { rank: NORMAL, amount: 8848, unit: 'Q11573' },
      { rank: PREFERRED, amount: 8848.86, unit: 'Q11573' },
      { rank: NORMAL, amount: 8850, unit: 'Q11573' },
    ])).toBe(8848.86);
  });

  it('converts feet and takes the median of equals, never a deprecated one', () => {
    expect(pickMetres([
      { rank: NORMAL, amount: 14411, unit: 'Q3710' },
      { rank: NORMAL, amount: 4392, unit: 'Q11573' },
      { rank: NORMAL, amount: 4393, unit: 'Q11573' },
      { rank: DEPRECATED, amount: 9000, unit: 'Q11573' },
    ])).toBeCloseTo(4392.47, 2);
    expect(pickMetres([{ rank: NORMAL, amount: 1, unit: 'Q42' }])).toBeNull();
  });
});

describe('kinds and names', () => {
  it('calls anything descended from volcano a volcano', () => {
    expect(kindOf(new Set(['mountain', 'volcano']))).toBe('volcano');
    expect(kindOf(new Set(['hill', 'summit']))).toBe('mountain');
    expect(kindOf(new Set(['hill']))).toBe('hill');
  });

  it("falls back to the article's title without its qualifier", () => {
    expect(unqualified('Mount Olympus (Washington)')).toBe('Mount Olympus');
    const names = namesFor(new Map([['mul', 'K2'], ['tr', 'K2 Dağı']]), { de: 'Olymp (Washington)' });
    expect(names).toEqual({ en: 'K2', tr: 'K2 Dağı', de: 'Olymp' });
  });

  it('indexes a measured peak with an English article or two page-language ones', () => {
    expect(isIndexed(5137, { en: 'Mount Ararat' })).toBe(true);
    expect(isIndexed(5137, { tr: 'Ağrı Dağı', de: 'Ararat' })).toBe(true);
    expect(isIndexed(5137, { tr: 'Ağrı Dağı' })).toBe(false);
    expect(isIndexed(null, { en: 'Mount Ararat' })).toBe(false);
  });
});

describe('slugs', () => {
  const peak = (qid: string, en: string, extra: Partial<SlugInput> = {}): SlugInput => ({
    qid, names: { en }, wiki: { en }, countries: ['United States'], kind: 'mountain', indexed: true, articles: 1, elev: 1000, ...extra,
  });

  it('folds the English name, else another Latin one, else the kind and number', () => {
    expect(baseSlug({ qid: 'Q1', names: { en: 'Mont Blanc' }, kind: 'mountain' })).toBe('mont-blanc');
    expect(baseSlug({ qid: 'Q1', names: { de: 'Großglockner', ja: '富士山' }, kind: 'mountain' })).toBe('grossglockner');
    expect(baseSlug({ qid: 'Q39231', names: { ja: '富士山' }, kind: 'volcano' })).toBe('volcano-39231');
  });

  it('gives the bare name to the better known, then the article title, then the country', () => {
    const slugs = assignSlugs([
      peak('Q3', 'Mount Olympus', { wiki: { en: 'Mount Olympus (Washington)' }, articles: 5 }),
      peak('Q2', 'Mount Olympus', { articles: 40, countries: ['Greece'] }),
      peak('Q4', 'Mount Olympus', { wiki: {}, articles: 1 }),
      peak('Q5', 'Mount Olympus', { wiki: {}, articles: 1 }),
    ], emptyLedger());
    expect(Object.fromEntries(slugs)).toEqual({
      Q2: 'mount-olympus', Q3: 'mount-olympus-washington', Q4: 'mount-olympus-united-states', Q5: 'mount-olympus-5',
    });
  });

  it('never moves a slug or hands out one held before', () => {
    const ledger = emptyLedger();
    ledger.byQid.set('Q9', 'everest');
    ledger.slugs.set('everest', 'Q9');
    ledger.slugs.set('k2', 'Q7');
    const slugs = assignSlugs([peak('Q9', 'Mount Everest'), peak('Q8', 'K2', { wiki: {}, countries: ['Pakistan'] })], ledger);
    expect(slugs.get('Q9')).toBe('everest');
    expect(slugs.get('Q8')).toBe('k2-pakistan');
  });
});

describe('term', () => {
  it('reads IRIs, tagged and typed literals', () => {
    expect(term('<http://www.wikidata.org/entity/Q513>')).toEqual({ value: 'http://www.wikidata.org/entity/Q513' });
    expect(term('"Ağrı \\"Dağı\\""@tr')).toEqual({ value: 'Ağrı "Dağı"', lang: 'tr' });
    expect(term('"8848.86"^^<http://www.w3.org/2001/XMLSchema#decimal>')).toEqual({ value: '8848.86' });
    expect(term('11')).toEqual({ value: '11' });
  });
});
