import { describe, expect, it } from 'vitest';
import { cityCoverage, createCityIndex, parseGeonames, type City } from './cities';

const city = (id: string, name: string, lat: number, lng: number, pop: number): City => ({ id, name, cc: 'TR', lat, lng, pop });
const istanbul = city('1', 'Istanbul', 41.01, 28.95, 15_000_000);
const esenyurt = city('2', 'Esenyurt', 41.03, 28.68, 900_000);
const silivri = city('3', 'Silivri', 41.07, 28.25, 90_000);
const cityAt = createCityIndex([istanbul, esenyurt, silivri]);

describe('createCityIndex', () => {
  it('folds a suburb into the metropolis that reaches it', () => {
    expect(cityAt(41.03, 28.7)?.name).toBe('Istanbul');
  });

  it('keeps a town beyond the metropolis on its own', () => {
    expect(cityAt(41.07, 28.26)?.name).toBe('Silivri');
    expect(cityAt(40, 30)).toBeNull();
  });
});

describe('cityCoverage', () => {
  const bus = (lat: number, lng: number, mode?: 'bus' | 'tram') => ({ lat, lng, mode });

  it("names a feed's cities with the modes running in each", () => {
    const vehicles = [...Array(20).fill(bus(41.0, 28.9)), ...Array(5).fill(bus(41.07, 28.26, 'tram')), bus(41.07, 28.25)];
    const out = cityCoverage([{ name: 'İETT', vehicles, modes: ['bus', 'tram'], center: [28.9, 41], local: false }], cityAt);
    expect(out.map(c => [c.name, c.vehicles, c.modes])).toEqual([['Istanbul', 20, []], ['Silivri', 6, ['tram']]]);
  });

  it('gives a local feed its routes.txt modes when the vehicles carry none', () => {
    const out = cityCoverage([{ name: 'Metro', vehicles: [bus(41, 28.9)], modes: ['tram', 'metro'], center: [28.9, 41], local: true }], cityAt);
    expect(out[0]).toMatchObject({ name: 'Istanbul', modes: ['metro', 'tram'], operators: ['Metro'] });
  });

  it('places a feed that was empty at its centre, with no vehicles counted', () => {
    const out = cityCoverage([{ name: 'Night', vehicles: [], modes: ['bus'], center: [28.95, 41.01], local: true }], cityAt);
    expect(out).toEqual([{ name: 'Istanbul', cc: 'TR', at: [28.95, 41.01], modes: ['bus'], vehicles: 0, operators: ['Night'] }]);
  });

  it('drops a city holding a sliver of a big feed', () => {
    const vehicles = [...Array(500).fill(bus(41.0, 28.9, 'bus')), bus(41.07, 28.26, 'bus')];
    expect(cityCoverage([{ name: 'Big', vehicles, modes: ['bus'], center: [28.9, 41], local: false }], cityAt).map(c => c.name)).toEqual(['Istanbul']);
  });
});

describe('parseGeonames', () => {
  it('reads name, country, position and population', () => {
    const row = ['745044', 'Istanbul', 'Istanbul', 'alt', '41.01384', '28.94966', 'P', 'PPLA', 'TR', '', '34', '', '', '', '15701602', '', '39', 'Europe/Istanbul', '2024-01-01'].join('\t');
    expect(parseGeonames(`${row}\n`)).toEqual([{ id: '745044', name: 'Istanbul', cc: 'TR', lat: 41.01384, lng: 28.94966, pop: 15701602 }]);
  });
});
