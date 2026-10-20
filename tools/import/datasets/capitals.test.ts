import { describe, expect, it } from 'vitest';
import { readCsv } from '../csv';
import { utc } from '../dates';
import { CAPITALS, capitalIn, parseCapitals } from './capitals';

const row = (key: string, from: string, to: string, city: string) => ({ key, from, to, city, lon: '1', lat: '2', official: '', note: '' });

describe('capitals', () => {
  it('finds the seat in force at a time, from inclusive and to exclusive', () => {
    const t = parseCapitals([row('BRA', '', '1960-04-21', 'Rio de Janeiro'), row('BRA', '1960-04-21', '', 'Brasília')]);
    expect(capitalIn(t, 'BRA', utc(1955, 11, 11))?.city).toBe('Rio de Janeiro');
    expect(capitalIn(t, 'BRA', utc(1960, 4, 21))?.city).toBe('Brasília');
    expect(capitalIn(t, 'XXX', utc(1960))).toBeUndefined();
  });

  it('has nothing outside a polity’s rows, so callers can try another polity', () => {
    const t = parseCapitals([row('hist:BRD', '1949-05-23', '1990-10-03', 'Bonn')]);
    expect(capitalIn(t, 'hist:BRD', utc(2022, 12, 8))).toBeUndefined();
  });

  it('never places at an official capital that is not the seat', () => {
    const t = parseCapitals([row('BOL', '', '', 'La Paz'), { ...row('BOL', '', '', 'Sucre'), official: '1' }]);
    expect(capitalIn(t, 'BOL', utc(1980))?.city).toBe('La Paz');
    expect(t.official.get('BOL')?.map(c => c.city)).toEqual(['Sucre']);
  });

  it('rejects overlapping rows and bad dates', () => {
    expect(() => parseCapitals([row('A', '', '1960', 'x'), row('A', '1950', '', 'y')])).toThrow(/overlap/);
    expect(() => parseCapitals([row('A', 'soon', '', 'x')])).toThrow(/bad date/);
  });

  it('parses the checked-in table', async () => {
    const t = parseCapitals(await readCsv(CAPITALS));
    expect(capitalIn(t, 'NGA', utc(1966, 1, 15))?.city).toBe('Lagos');
    expect(capitalIn(t, 'hist:YAR', utc(1955, 4, 2))?.city).toBe('Taiz');
    expect(capitalIn(t, 'BOL', utc(1980, 7, 17))?.city).toBe('La Paz');
  });
});
