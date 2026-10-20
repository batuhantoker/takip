import { Prec } from '@takip/core/time';
import { GeoPrec } from '@takip/db';
import { describe, expect, it } from 'vitest';
import { utc } from '../dates';
import type { GeoIndex } from '../geo/geo-index';
import type { Row } from './wikidata';
import { bounded, pickName, type RecoverData, Recovery, siblingMiddles } from './wikidata-recover';

const row = (fields: Partial<Row>): Row => ({ item: 'Q1', classes: '', ...fields });
const data = (d: Partial<RecoverData>): RecoverData => ({ items: {}, places: {}, articles: {}, ...d });

describe('recovered names', () => {
  it('prefers English, then the SPARQL fallbacks, then Latin scripts, then article titles', () => {
    expect(pickName({ uk: 'Битва', nl: 'Slag bij X' })).toBe('Slag bij X');
    expect(pickName({ zh: '战役', ja: '戦い' })).toBe('戦い');
    expect(pickName({}, { uk: 'Битва під X' })).toBe('Битва під X');
    expect(pickName({ pl: 'Bitwa' }, { en: 'Battle' })).toBe('Bitwa');
  });

  it('takes the fetched name, else an article title from sitelinks.json', () => {
    const rec = new Recovery(data({ items: { Q1: { name: 'Bitwa pod X' } } }), [], [], { Q2: { uk: 'Битва' } });
    expect(rec.label(row({}))).toBe('Bitwa pod X');
    expect(rec.label(row({ item: 'Q2' }))).toBe('Битва');
    expect(rec.label(row({ item: 'Q3' }))).toBeNull();
  });
});

describe('recovered dates', () => {
  it('spans earliest and latest dates with the smallest year, decade or century', () => {
    expect(bounded(['1100-01-01T00:00:00Z/9'], ['1150-01-01T00:00:00Z/9'])).toEqual({ t: utc(1100), prec: Prec.century });
    expect(bounded(['1914-01-01T00:00:00Z/9'], ['1918-01-01T00:00:00Z/9'])).toEqual({ t: utc(1914), prec: Prec.decade });
    expect(bounded(['1150-01-01T00:00:00Z/9'], ['1250-01-01T00:00:00Z/9'])).toBeNull();
    expect(bounded(['1150-01-01T00:00:00Z/9'], undefined)).toBeNull();
  });

  it('takes fetched statements before any text', () => {
    const rec = new Recovery(data({ items: { Q1: { P571: ['1820-05-01T00:00:00Z/10'] } } }), [], []);
    expect(rec.date(row({ desc: '1818 rebellion' }), 'other')).toMatchObject({ t: utc(1820, 5), prec: Prec.month, how: 'inception' });
  });

  it('marks a year read from the description or the name', () => {
    const rec = new Recovery(data({}), [], []);
    expect(rec.date(row({ desc: '1858 treaty' }), 'treaty')).toMatchObject({ t: utc(1858), prec: Prec.year, from: 'year in its Wikidata description' });
    expect(rec.date(row({ label: 'Siege of X (1683)' }), 'battle')).toMatchObject({ t: utc(1683), from: 'year in its name' });
    expect(rec.date(row({ desc: 'conflict in India (1793-1806)' }), 'other')).toMatchObject({ t: utc(1793), end: { t: utc(1806), prec: Prec.year } });
  });

  it("drops a year outside the item's war, and dates a battle by a war that lasted one year", () => {
    const war = row({ item: 'W', label: 'Short War', t0: '1866-06-14T00:00:00Z/11', t1: '1866-08-23T00:00:00Z/11' });
    const rec = new Recovery(data({}), [war], []);
    expect(rec.date(row({ wars: 'W', desc: '1870 battle' }), 'battle')).toMatchObject({ t: utc(1866), prec: Prec.year, from: 'year of Short War' });
    expect(rec.date(row({ wars: 'W', desc: '1866 battle' }), 'battle')).toMatchObject({ from: 'year in its Wikidata description' });
    const long = row({ item: 'L', t0: '1618-01-01T00:00:00Z/9', t1: '1648-01-01T00:00:00Z/9' });
    expect(new Recovery(data({}), [long], []).date(row({ wars: 'L' }), 'battle')).toBeNull();
    const point = row({ item: 'P', label: 'Dissolution', t: '1830-11-21T00:00:00Z/11' });
    expect(new Recovery(data({}), [point], []).date(row({ wars: 'P' }), 'battle')).toBeNull();
  });
});

describe('recovered places', () => {
  const places = {
    P_city: { name: 'Tilsit', coord: [21.88, 55.08] as [number, number] },
    P_fort: { name: 'Fort X', P131: ['P_city'] },
    P_country: { name: 'Ruritania', coord: [20, 50] as [number, number] },
    P_old: { name: 'Kingdom of Y', P36: ['P_city'] },
  };

  it("prefers an article's point, then a chain through what a place lies in, then the country", () => {
    const rec = new Recovery(
      data({
        items: { Q1: { sites: { fr: 'Bataille de X', en: 'Battle of X' }, P276: ['P_fort'], P17: ['P_country'] }, Q2: { P276: ['P_fort'], P17: ['P_country'] }, Q3: { P17: ['P_country'] }, Q9: { P17: ['P_country'] } },
        places,
        articles: { 'en:Battle of X': [10, 20, 'city'], 'fr:Bataille de X': [11, 21] },
      }),
      [],
      [],
    );
    expect(rec.place(row({}), 'other')).toMatchObject({ lon: 10, lat: 20, geoPrec: GeoPrec.city, placedAt: 'point its English Wikipedia article gives' });
    expect(rec.place(row({ item: 'Q2' }), 'other')).toMatchObject({ lon: 21.88, geoPrec: GeoPrec.approximate, placedAt: 'point Wikidata gives for Tilsit' });
    expect(rec.place(row({ item: 'Q3' }), 'other')).toMatchObject({ lon: 20, lat: 50, geoPrec: GeoPrec.country });
  });

  it('places at a coordless country through its capital, and at one of several only where the row carried a country', () => {
    const rec = new Recovery(data({ items: { Q1: { P17: ['P_old'] }, Q2: { P17: ['P_country', 'P_two'] } }, places: { ...places, P_two: { name: 'Two', coord: [5, 5] } } }), [], []);
    expect(rec.place(row({}), 'other')).toMatchObject({ lon: 21.88, geoPrec: GeoPrec.country, placedAt: 'capital of Kingdom of Y' });
    const sampled = { lon: 5, lat: 5, geoPrec: GeoPrec.country };
    expect(rec.place(row({ item: 'Q2' }), 'other', undefined, sampled)).toMatchObject({ lon: 20, geoPrec: GeoPrec.country, placedAt: 'point Wikidata gives for Ruritania, one of the countries it names' });
    expect(rec.place(row({ item: 'Q2' }), 'other')).toBeNull();
  });

  it('leaves unplaced what only a dissolved or vast country places, and skips them on the way up', () => {
    const notes: string[] = [];
    const rep = { sentinel: (s: string) => notes.push(s) } as never;
    const rec = new Recovery(
      data({
        items: { Q1: { P17: ['Q15180'] }, Q2: { P17: ['P_gone'] }, Q3: { P131: ['P_sanjak'], P17: ['Q12560'] }, Q4: { P17: ['P_gone', 'P_country'] } },
        places: { ...places, Q15180: { name: 'Soviet Union', coord: [90, 65] }, Q12560: { name: 'Ottoman Empire', coord: [35, 39] }, P_gone: { name: 'Old Kingdom', coord: [1, 1], dissolved: true }, P_sanjak: { name: 'Sanjak of Niš', P131: ['Q12560'] } },
      }),
      [],
      [],
    );
    expect(rec.place(row({}), 'other', rep, { lon: 90, lat: 65, geoPrec: GeoPrec.country })).toBeNull();
    expect(rec.place(row({ item: 'Q2' }), 'other', rep)).toBeNull();
    expect(rec.place(row({ item: 'Q3' }), 'other', rep)).toBeNull();
    expect(notes.filter(n => n.includes('dissolved or vast'))).toHaveLength(3);
    expect(rec.place(row({ item: 'Q4' }), 'other')).toMatchObject({ lon: 20, geoPrec: GeoPrec.country });
    expect(rec.place(row({ item: 'Q9' }), 'other', rep, null, undefined, true)).toBeNull();
    expect(notes.filter(n => n.includes('dissolved or vast'))).toHaveLength(4);
  });

  it("uses the row's sampled country point only for an item that wasn't fetched", () => {
    const rec = new Recovery(data({ items: { Q2: {} }, places }), [], []);
    expect(rec.place(row({}), 'other', undefined, { lon: 3, lat: 4, geoPrec: GeoPrec.country })).toMatchObject({ lon: 3, lat: 4, geoPrec: GeoPrec.country });
    expect(rec.place(row({ item: 'Q2' }), 'other', undefined, { lon: 3, lat: 4, geoPrec: GeoPrec.country })).toBeNull();
  });

  it("takes a coordless region's capital before what the region lies in", () => {
    const rec = new Recovery(data({ items: { Q1: { P276: ['P_sanjak'] } }, places: { P_sanjak: { name: 'Niš sanjak', P36: ['P_nis'], P131: ['P_vilayet'] }, P_nis: { name: 'Niš', coord: [21.9, 43.32] }, P_vilayet: { name: 'Danube Vilayet', coord: [25, 43] } } }), [], []);
    expect(rec.place(row({}), 'other')).toMatchObject({ lon: 21.9, geoPrec: GeoPrec.approximate, placedAt: 'capital of Niš sanjak' });
  });

  it('calls a place that is some item\'s country a country', () => {
    const rec = new Recovery(data({ items: { Q1: { P131: ['P_country'] }, Q5: { P17: ['P_country'] } }, places }), [], []);
    expect(rec.place(row({}), 'other')).toMatchObject({ geoPrec: GeoPrec.country });
  });

  it("puts a battle at its siblings' middle when they lie close, else hollow at its war's own point", () => {
    const near = (i: number) => row({ item: `B${i}`, wars: 'W', coord: `Point(${10 + i * 0.1} 50)` });
    const war = row({ item: 'W', label: 'Some War', coord: 'Point(30 40)' });
    const rec = new Recovery(data({}), [war], [near(0), near(1), near(2)]);
    expect(rec.place(row({ wars: 'W' }), 'battle')).toMatchObject({ lon: 10.1, lat: 50, geoPrec: GeoPrec.approximate, placedAt: 'middle of the other battles of Some War' });
    expect(rec.place(row({ wars: 'W' }), 'other')).toBeNull();
    const few = new Recovery(data({}), [war], [near(0)]);
    expect(few.place(row({ wars: 'W' }), 'battle')).toMatchObject({ lon: 30, lat: 40, geoPrec: GeoPrec.approximate, placedAt: 'point Wikidata gives for Some War' });
    const wide = new Recovery(data({}), [war], [near(0), row({ item: 'B8', wars: 'W', coord: 'Point(100 0)' }), row({ item: 'B9', wars: 'W', coord: 'Point(-70 -30)' })]);
    expect(wide.place(row({ wars: 'W' }), 'battle')).toBeNull();
    const located = new Recovery(data({}), [row({ item: 'W', locCoord: 'Point(30 40)' })], []);
    expect(located.place(row({ wars: 'W' }), 'battle')).toBeNull();
  });

  it('measures each parent with three placed battles', () => {
    const m = siblingMiddles([row({ item: 'A', wars: 'W', coord: 'Point(1 1)' }), row({ item: 'B', wars: 'W', coord: 'Point(1.1 1)' }), row({ item: 'C', wars: 'W|V', coord: 'Point(1.2 1)' })]);
    expect([...m.keys()]).toEqual(['W']);
    expect(m.get('W')!.spread).toBeLessThan(15);
  });
});

describe('the geolocation resolver in the recovery', () => {
  const index: GeoIndex = {
    item: () => null,
    articles: qid => (qid === 5 ? [{ lon: 2.29, lat: 49.9, wiki: 'en', title: 'Battle of X', qid: 5, dim: null, type: null }] : []),
    articleByTitle: () => null,
    places: () => [],
    country: () => null,
  };
  const geo = { index, wars: new Map([['W', [1, 2, 3].map(i => ({ item: `B${i}`, p: { lon: 10 + i * 0.1, lat: 50 } }))]]) };
  const fetched = data({ items: { Q5: { P131: ['P_city'] }, Q6: { coord: [7, 7] } }, places: { P_city: { name: 'Tilsit', coord: [21.88, 55.08] } } });

  it("comes after the item's own fetched point and before Wikidata's place statements, and says how it placed", () => {
    const rec = new Recovery(fetched, [], [], {}, geo);
    expect(rec.place(row({ item: 'Q6' }), 'other')).toMatchObject({ lon: 7, geoPrec: GeoPrec.exact });
    expect(rec.place(row({ item: 'Q5' }), 'other')).toMatchObject({ lon: 2.29, method: 'article', geoPrec: GeoPrec.exact });
    expect(rec.place(row({ item: 'Q5' }), 'other')?.confidence).toBeGreaterThan(0.9);
  });

  it("leaves a treaty's articles and related treaties out", () => {
    const rec = new Recovery(fetched, [], [], {}, geo);
    expect(rec.place(row({ item: 'Q5' }), 'treaty')).toMatchObject({ lon: 21.88, placedAt: 'point Wikidata gives for Tilsit' });
    expect(new Recovery(data({}), [], [], {}, geo).place(row({ item: 'Q7', wars: 'W' }), 'treaty')).toBeNull();
  });

  it('shows a middle of related events as approximate', () => {
    const rec = new Recovery(data({}), [], [], {}, geo);
    expect(rec.place(row({ item: 'Q7', wars: 'W' }), 'other')).toMatchObject({ method: 'related', geoPrec: GeoPrec.approximate, placedAt: 'middle of related events' });
  });
});
