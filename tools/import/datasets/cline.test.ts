import { Prec } from '@takip/core/time';
import { describe, expect, it } from 'vitest';
import { utc } from '../dates';
import { type ClineCoup, matchCoups, namesCountry } from './cline';

const lagos = { city: 'Lagos', lon: 3.39, lat: 6.45, lo: -Infinity, hi: utc(1991, 12, 12) };
const abuja = { city: 'Abuja', lon: 7.5, lat: 9.06, lo: utc(1991, 12, 12), hi: Infinity };
const nigeria = (id: string, t: number): ClineCoup => ({ id, t, country: 'Nigeria', capitals: [lagos, abuja], lon: lagos.lon, lat: lagos.lat });

describe('namesCountry', () => {
  it('reads the country or its adjective in a label', () => {
    expect(namesCountry('1966 Nigerian counter-coup', 'Nigeria')).toBe(true);
    expect(namesCountry("1976 Argentine coup d'état", 'Argentina')).toBe(true);
    expect(namesCountry("Coup d'État de 1980 en Bolivie", 'Bolivia')).toBe(true);
    expect(namesCountry('Removal of Khrushchev', 'Soviet Union')).toBe(false);
  });
});

describe('matchCoups', () => {
  it('links the Wikidata coup a few days off at any of the country’s capitals', () => {
    const { pairs } = matchCoups([nigeria('a', utc(1966, 7, 29))], [{ id: 1, title: 'Nigerian Counter-Coup of 1966', t: utc(1966, 7, 26), prec: Prec.day, lon: 7.5, lat: 9.06 }]);
    expect(pairs).toEqual([['a', 1]]);
    expect(matchCoups([nigeria('a', utc(1966, 7, 29))], [{ id: 1, title: 'Coup', t: utc(1966, 7, 25), prec: Prec.day, lon: 3.39, lat: 6.45 }]).pairs).toEqual([]);
  });

  it('leaves a same-day coup elsewhere alone, and a year-dated one', () => {
    const { pairs } = matchCoups([nigeria('a', utc(1966, 7, 29))], [
      { id: 1, title: 'Algiers putsch', t: utc(1966, 7, 29), prec: Prec.day, lon: 3.05, lat: 36.75 },
      { id: 2, title: '1966 Nigerian coup', t: utc(1966), prec: Prec.year, lon: 3.39, lat: 6.45 },
    ]);
    expect(pairs).toEqual([]);
  });

  it('takes a far point when the label names the country, and counts two equally close coups as ambiguous', () => {
    const far = { id: 1, title: 'July 1966 Nigerian coup', t: utc(1966, 7, 29), prec: Prec.day, lon: 8.5, lat: 10.5 };
    expect(matchCoups([nigeria('a', utc(1966, 7, 29))], [far]).pairs).toEqual([['a', 1]]);
    const twice = matchCoups([nigeria('a', utc(1966, 7, 28)), nigeria('b', utc(1966, 7, 30))], [{ ...far, lon: 3.39, lat: 6.45 }]);
    expect(twice).toEqual({ pairs: [], ambiguous: 1 });
  });

  it('prefers the coup on the same day over the one a day off', () => {
    const w = { id: 1, title: 'Coup', t: utc(1993, 9, 21), prec: Prec.day, lon: 3.39, lat: 6.45 };
    expect(matchCoups([nigeria('a', utc(1993, 9, 21)), nigeria('b', utc(1993, 9, 22))], [w]).pairs).toEqual([['a', 1]]);
  });
});
