import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  boundaryTitle, cellBox, cellOf, levelForZoom, parseBoundaries, pickBoundary, resolvePick, wrapLng,
  type Boundary, type BoundaryLookup, type SubLevel,
} from './boundaries';

const square = (w: number, s: number, e: number, n: number) => [[w, s], [e, s], [e, n], [w, n], [w, s]];

const fc = (features: object[]) => ({ features: features as GeoJSON.Feature[] });
const feature = (properties: object, coordinates: number[][][]) =>
  ({ type: 'Feature', properties, geometry: { type: 'Polygon', coordinates } });

const COUNTRIES = parseBoundaries(fc([
  feature({ id: 'AAA', name: 'Alpha', iso3: 'AAA' }, [square(0, 0, 10, 10)]),
  feature({ id: 'BBB', name: 'Bravo', iso3: 'BBB' }, [square(10, 0, 20, 10)]),
  { type: 'Feature', properties: { id: 'FJI', name: 'Fiji' }, geometry: { type: 'MultiPolygon', coordinates: [[square(177, -19, 180, -16)], [square(-180, -19, -178, -16)]] } },
]), 'country');

const ALPHA_STATES = parseBoundaries(fc([
  feature({ id: 'AAA-1', name: 'West', country: 'Alpha', countryId: 'AAA', label: [2, 5] }, [square(0, 0, 5, 10)]),
  // Leaves a sliver at 5–5.5, as simplified neighbours do.
  feature({ id: 'AAA-2', name: 'East', country: 'Alpha', countryId: 'AAA' }, [square(5.5, 0, 10, 10)]),
]), 'admin1');

const WEST_DISTRICTS = parseBoundaries(fc([
  feature({ id: 'W-north', name: 'Northside' }, [square(0, 5, 5, 10)]),
]), 'admin2', 'geoBoundaries · Test · PD');

const WEST_SUBDISTRICTS = parseBoundaries(fc([
  feature({ id: 'W-n-1', name: 'Hamlet' }, [square(0, 5, 2, 7)]),
]), 'admin3');

/** Per country id and level: an array, null for "none at this level", absent for "still loading". */
const lookupFrom = (table: Record<string, Partial<Record<SubLevel, Boundary[] | null>>>): BoundaryLookup =>
  (country, level) => table[country.id]?.[level];

const ALL = lookupFrom({ AAA: { admin1: ALPHA_STATES, admin2: WEST_DISTRICTS, admin3: WEST_SUBDISTRICTS }, BBB: { admin1: [], admin2: null, admin3: null } });

describe('levelForZoom', () => {
  it('steps down a level at each threshold', () => {
    expect(levelForZoom(2)).toBe('country');
    expect(levelForZoom(4)).toBe('admin1');
    expect(levelForZoom(6.9)).toBe('admin1');
    expect(levelForZoom(7)).toBe('admin2');
    expect(levelForZoom(12)).toBe('admin3');
  });
});

describe('wrapLng', () => {
  it('folds longitudes from a map panned across the dateline', () => {
    expect(wrapLng(190)).toBe(-170);
    expect(wrapLng(-190)).toBe(170);
    expect(wrapLng(45)).toBe(45);
    expect(wrapLng(540)).toBe(-180);
  });
});

describe('parseBoundaries', () => {
  it('skips features without an id, a name or an area', () => {
    const parsed = parseBoundaries(fc([
      feature({ name: 'no id' }, [square(0, 0, 1, 1)]),
      feature({ id: 'X' }, [square(0, 0, 1, 1)]),
      { type: 'Feature', properties: { id: 'P', name: 'point' }, geometry: { type: 'Point', coordinates: [0, 0] } },
      feature({ id: 'OK', name: 'Fine', label: ['bad', 1] }, [square(0, 0, 1, 1)]),
    ]), 'country');
    expect(parsed.map(b => b.id)).toEqual(['OK']);
    expect(parsed[0].countryId).toBe('OK');
    expect(parsed[0].label).toBeNull();
  });

  it('carries the credit line onto every outline', () => {
    expect(WEST_DISTRICTS[0].source).toBe('geoBoundaries · Test · PD');
  });
});

describe('pickBoundary', () => {
  it('finds the outline under the point, or nothing at sea', () => {
    expect(pickBoundary(15, 5, COUNTRIES)?.id).toBe('BBB');
    expect(pickBoundary(50, 50, COUNTRIES)).toBeNull();
  });

  it('finds both halves of a country split at the dateline, from either side of it', () => {
    expect(pickBoundary(178, -17, COUNTRIES)?.id).toBe('FJI');
    expect(pickBoundary(-179, -17, COUNTRIES)?.id).toBe('FJI');
    expect(pickBoundary(181, -17, COUNTRIES)?.id).toBe('FJI');
  });
});

describe('resolvePick', () => {
  it('stops at the level asked for', () => {
    expect(resolvePick(1, 6, 'country', COUNTRIES, ALL).boundary?.id).toBe('AAA');
    expect(resolvePick(1, 6, 'admin1', COUNTRIES, ALL).boundary?.id).toBe('AAA-1');
    expect(resolvePick(1, 6, 'admin2', COUNTRIES, ALL).boundary?.id).toBe('W-north');
    expect(resolvePick(1, 6, 'admin3', COUNTRIES, ALL).boundary?.id).toBe('W-n-1');
  });

  it('keeps the chain of containing outlines, country first', () => {
    const { parents } = resolvePick(1, 6, 'admin3', COUNTRIES, ALL);
    expect(parents.map(p => p.id)).toEqual(['AAA', 'AAA-1', 'W-north']);
  });

  it('reports loading, with the best outline found so far', () => {
    const r = resolvePick(1, 6, 'admin2', COUNTRIES, lookupFrom({ AAA: { admin1: ALPHA_STATES } }));
    expect(r).toMatchObject({ loading: true });
    expect(r.boundary?.id).toBe('AAA-1');
  });

  it('keeps the coarser outline where a level is missing, in a sliver, or not offered', () => {
    expect(resolvePick(15, 5, 'admin3', COUNTRIES, ALL).boundary?.id).toBe('BBB');
    expect(resolvePick(5.2, 5, 'admin1', COUNTRIES, ALL).boundary?.id).toBe('AAA');
    // Outside every district but inside a state.
    expect(resolvePick(1, 2, 'admin3', COUNTRIES, ALL)).toMatchObject({ boundary: { id: 'AAA-1' }, loading: false });
  });

  it('skips a missing level and still reaches a finer one', () => {
    const r = resolvePick(1, 6, 'admin3', COUNTRIES, lookupFrom({ AAA: { admin1: ALPHA_STATES, admin2: null, admin3: WEST_SUBDISTRICTS } }));
    expect(r.boundary?.id).toBe('W-n-1');
    expect(r.parents.map(p => p.id)).toEqual(['AAA', 'AAA-1']);
  });

  it('needs nothing at sea', () => {
    expect(resolvePick(50, 50, 'admin3', COUNTRIES, ALL)).toEqual({ boundary: null, parents: [], loading: false });
  });
});

describe('boundaryTitle', () => {
  it('names an outline with what contains it, without repeats', () => {
    const r = resolvePick(1, 6, 'admin3', COUNTRIES, ALL);
    expect(boundaryTitle(r.boundary!, r.parents)).toBe('Hamlet, Northside, West, Alpha');
    expect(boundaryTitle({ name: 'Berlin' }, [{ name: 'Germany' }, { name: 'Berlin' }])).toBe('Berlin, Germany');
  });

  it('falls back to the stored country name, or the name alone', () => {
    expect(boundaryTitle(ALPHA_STATES[0])).toBe('West, Alpha');
    expect(boundaryTitle(COUNTRIES[0])).toBe('Alpha');
  });
});

describe('cells', () => {
  it('round-trips a point to the square containing it', () => {
    const box = cellBox(cellOf(11.58, 48.14))!;
    expect(box.west).toBeLessThanOrEqual(11.58);
    expect(box.east).toBeGreaterThan(11.58);
    expect(box.south).toBeLessThanOrEqual(48.14);
    expect(box.north).toBeGreaterThan(48.14);
    expect(cellOf(-0.5, -0.5)).toBe('-1_-1');
    expect(cellOf(190, 10)).toBe(cellOf(-170, 10));
  });

  it('rejects malformed or out-of-range cells', () => {
    expect(cellBox('1_2')).not.toBeNull();
    expect(cellBox('-45_-23')).not.toBeNull();
    expect(cellBox('45_0')).toBeNull();
    expect(cellBox('0_23')).toBeNull();
    expect(cellBox('1,2')).toBeNull();
    expect(cellBox('../x')).toBeNull();
  });
});

const DATA_DIR = path.join(process.cwd(), 'public', 'data', 'boundaries');

// Built by tools/build-boundaries.mjs.
describe.skipIf(!existsSync(path.join(DATA_DIR, 'countries.json')))('the generated data', () => {
  const read = (file: string) => JSON.parse(readFileSync(path.join(DATA_DIR, file), 'utf8'));
  const countries = parseBoundaries(read('countries.json'), 'country');
  const states: BoundaryLookup = (country, level) =>
    level === 'admin1' ? parseBoundaries(read(`admin1/${country.id}.json`), 'admin1') : null;

  it('places well-known points in the right country and state', () => {
    expect(pickBoundary(11.58, 48.14, countries)?.name).toBe('Germany'); // Munich
    expect(resolvePick(11.58, 48.14, 'admin1', countries, states).boundary?.name).toBe('Bavaria');
    expect(resolvePick(-97.74, 30.27, 'admin1', countries, states).boundary?.name).toBe('Texas'); // Austin
    expect(resolvePick(32.86, 39.93, 'admin1', countries, states).boundary?.name).toBe('Ankara');
  });

  it('handles the dateline and enclaves', () => {
    expect(pickBoundary(-175, 66, countries)?.id).toBe('RUS'); // Chukotka, east of 180
    expect(pickBoundary(28.2, -29.6, countries)?.id).toBe('LSO'); // Lesotho, inside South Africa
  });

  it('leaves the open ocean empty', () => {
    expect(pickBoundary(-30, 30, countries)).toBeNull();
  });

  it('gives geoBoundaries the ISO code it files countries under', () => {
    const iso = (id: string) => countries.find(c => c.id === id)?.iso3;
    expect(iso('DEU')).toBe('DEU');
    expect(iso('SDS')).toBe('SSD');
    expect(iso('KOS')).toBe('XKX');
  });
});
