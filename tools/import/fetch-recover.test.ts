import { describe, expect, it } from 'vitest';
import type { Row } from './datasets/wikidata';
import { compactItem, compactPlace, jsonTime, julianToGregorian, wants } from './fetch-recover';

const JULIAN = 'http://www.wikidata.org/entity/Q1985786';
const GREGORIAN = 'http://www.wikidata.org/entity/Q1985727';
const row = (fields: Partial<Row>): Row => ({ item: 'Q1', classes: '', ...fields });

describe('entity times as the SPARQL rows carry them', () => {
  it('turns Julian days Gregorian, as the RDF export does (Hastings: 14 October becomes 20 October)', () => {
    expect(jsonTime({ time: '+1066-10-14T00:00:00Z', precision: 11, calendarmodel: JULIAN })).toBe('1066-10-20T00:00:00Z/11');
    expect(julianToGregorian(1582, 10, 5)).toEqual([1582, 10, 15]);
  });

  it('counts BCE years astronomically and leaves coarser Julian dates alone', () => {
    expect(jsonTime({ time: '-0362-07-04T00:00:00Z', precision: 11, calendarmodel: JULIAN })).toBe('-0361-06-29T00:00:00Z/11');
    expect(jsonTime({ time: '-0086-00-00T00:00:00Z', precision: 9, calendarmodel: JULIAN })).toBe('-0085-01-01T00:00:00Z/9');
    expect(jsonTime({ time: '+0530-06-00T00:00:00Z', precision: 10, calendarmodel: JULIAN })).toBe('0530-06-01T00:00:00Z/10');
    expect(jsonTime({ time: '+1944-06-06T00:00:00Z', precision: 11, calendarmodel: GREGORIAN })).toBe('1944-06-06T00:00:00Z/11');
    expect(jsonTime(undefined)).toBeNull();
  });
});

describe('compact items', () => {
  const item = (id: string) => ({ snaktype: 'value', datavalue: { value: { id } } });
  it('keeps best-ranked statements, Earth coordinates and the bounds of an unknown date', () => {
    const rec = compactItem({
      labels: { uk: { value: 'Битва' } },
      sitelinks: { ukwiki: { title: 'Битва під X' }, commonswiki: { title: 'Category:X' }, zh_yuewiki: { title: '戰' } },
      claims: {
        P17: [{ mainsnak: item('Q1'), rank: 'normal' }, { mainsnak: item('Q2'), rank: 'preferred' }],
        P131: [{ mainsnak: item('Q3'), rank: 'deprecated' }],
        P625: [{ mainsnak: { snaktype: 'value', datavalue: { value: { latitude: 1, longitude: 2, globe: 'http://www.wikidata.org/entity/Q405' } } }, rank: 'normal' }],
        P585: [{
          mainsnak: { snaktype: 'somevalue' },
          rank: 'normal',
          qualifiers: {
            P1319: [{ snaktype: 'value', datavalue: { value: { time: '+1100-00-00T00:00:00Z', precision: 9 } } }],
            P1326: [{ snaktype: 'value', datavalue: { value: { time: '+1150-00-00T00:00:00Z', precision: 9 } } }],
          },
        }],
        P361: [{ mainsnak: item('Q9'), rank: 'normal' }],
      },
    });
    expect(rec).toEqual({
      name: 'Битва',
      sites: { uk: 'Битва під X', 'zh-yue': '戰' },
      P17: ['Q2'],
      parts: ['Q9'],
      P1319: ['1100-01-01T00:00:00Z/9'],
      P1326: ['1150-01-01T00:00:00Z/9'],
    });
  });
});

describe('compact places', () => {
  it('knows a country has ended only when its claims were fetched', () => {
    const ended = { snaktype: 'value', datavalue: { value: { time: '+1991-12-26T00:00:00Z', precision: 11 } } };
    expect(compactPlace({ labels: { en: { value: 'Soviet Union' } }, claims: { P576: [{ mainsnak: ended, rank: 'normal' }] } })).toEqual({ name: 'Soviet Union', dissolved: true });
    expect(compactPlace({ labels: { en: { value: 'France' } }, claims: {} })).toEqual({ name: 'France', dissolved: false });
    expect(compactPlace({ labels: { en: { value: 'Paris' } } })).toEqual({ name: 'Paris' });
  });
});

describe('items to recover', () => {
  it("re-runs each importer's label, date and place rules", () => {
    expect(wants('battles', row({ label: 'B', t: '1900-01-01T00:00:00Z/9', locCoord: 'Point(1 2)' }))).toEqual({ label: false, date: false, place: false });
    expect(wants('battles', row({ t: '1900-01-01T00:00:00Z/9' }))).toEqual({ label: true, date: false, place: true });
    expect(wants('wars', row({ label: 'W', t0: '1900-01-01T00:00:00Z/9', locCoord: 'Point(1 2)', countryCoord: 'Point(1 2)' })).place).toBe(false);
    expect(wants('wars', row({ label: 'W', t0: '1900-01-01T00:00:00Z/9', countryCoord: 'Point(1 2)' })).place).toBe(true);
    expect(wants('battles', row({ label: 'B', t0: '1900-01-01T00:00:00Z/9', countryCoord: 'Point(1 2)' })).place).toBe(true);
    expect(wants('politics', row({ label: 'T', inception: '1900-01-01T00:00:00Z/9', signCoord: 'Point(1 2)' }))).toEqual({ label: false, date: false, place: false });
    expect(wants('politics', row({ label: 'C', classes: 'Q45382', inception: '1900-01-01T00:00:00Z/9', capital: 'Q1 Point(1 2)' })).date).toBe(true);
    expect(wants('massacres', row({ label: 'M', t: '1900-01-01T00:00:00Z/9', countryCoord: 'Point(1 2)' })).place).toBe(true);
    expect(wants('displacements', row({ label: 'D', t: '1900-01-01T00:00:00Z/9', fromCoord: 'Point(1 2)' })).place).toBe(false);
  });
});
