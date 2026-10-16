import { describe, expect, it } from 'vitest';
import { readCsv } from '../csv';
import { readTerritorialPlaces, TERRITORIAL_ROWS, WW2_MATCHES } from './cow-territorial';

describe('cow territorial places', () => {
  it('names a place for every territory a row points at', async () => {
    const places = await readTerritorialPlaces();
    const rows = await readCsv(TERRITORIAL_ROWS);
    expect(rows).toHaveLength(842);
    const unplaced = rows.filter(r => !places.has(r.fix || r.entity)).map(r => r.number);
    expect(unplaced).toEqual(['879']);
    expect(places.get(rows.find(r => r.number === '5')!.entity)?.name).toBe('Gambia');
    expect(places.get(rows.find(r => r.number === '360')!.fix)).toEqual({ name: 'Clipperton Island', lon: -109.22, lat: 10.3 });
  });
});

describe('cow links', () => {
  it('matches each WW2 change once, and same_as only one to one', () => {
    const ww2 = WW2_MATCHES.map(m => m[1]);
    expect(new Set(ww2).size).toBe(ww2.length);
    const same = WW2_MATCHES.filter(m => m[2] === 'same_as').map(m => m[0]);
    expect(new Set(same).size).toBe(same.length);
  });
});
