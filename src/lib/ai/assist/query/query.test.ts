import { describe, expect, it } from 'vitest';
import { greatCircle, inPolygon, km } from './geo';
import { runQuery } from './run';
import { readFilters, readSort } from './spec';

const NOW = Date.parse('2026-10-16T12:00:00Z');

const bag = () => ({
  commercial_flights: [
    { icao24: 'aa0001', callsign: 'DAL12', lat: 40.6, lng: -73.8, alt: 10_700, speed_knots: 460, squawk: '1200', grounded: false, model: 'B763', registration: 'N171DN' },
    { icao24: 'aa0002', callsign: 'UAL9', lat: 41.9, lng: -87.9, alt: 900, speed_knots: 180, squawk: '7700', grounded: false },
    { icao24: 'aa0003', callsign: 'SWA5', lat: 32.9, lng: -97.0, alt: 0, speed_knots: 10, squawk: '', grounded: true },
  ],
  private_flights: [], private_jets: [],
  military_flights: [{ icao24: 'ae1234', callsign: 'RCH55', lat: 31.0, lng: -97.5, alt: 8_000, speed_knots: 400 }],
  earthquakes: [
    { id: 'q1', lat: 35.7, lng: 139.7, magnitude: 5.6, depth: 30, place: 'Tokyo', time: NOW - 3_600_000 },
    { id: 'q2', lat: 38.3, lng: 142.4, magnitude: 6.2, depth: 10, place: 'Miyagi', time: NOW - 30 * 3_600_000 },
  ],
});

/** A square round Texas, roughly. */
const TEXAS: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[[-106.6, 25.8], [-93.5, 25.8], [-93.5, 36.5], [-106.6, 36.5], [-106.6, 25.8]]] };

describe('checking a query before it runs', () => {
  it('reads fields, operators and units, and refuses what it cannot', () => {
    const ok = readFilters(['flights'], [{ field: 'altitude', op: '>', value: '30000 ft' }, { field: 'emergency', op: 'eq', value: true }]);
    expect('filters' in ok && ok.filters).toEqual([
      { field: 'altitude', op: 'gt', value: 30000 * 0.3048, type: 'number' },
      { field: 'emergency', op: 'eq', value: true, type: 'flag' },
    ]);
    const fl = readFilters(['flights'], [{ field: 'altitude', op: 'gte', value: 'FL350' }]);
    expect('filters' in fl && fl.filters[0].value).toBeCloseTo(10668);
    const withUnit = readFilters(['flights'], [{ field: 'speed(km/h)', op: 'lt', value: 100 }]);
    expect('filters' in withUnit && withUnit.filters[0].value).toBeCloseTo(100 / 3.6 / (1852 / 3600));

    const typo = readFilters(['flights'], [{ field: 'altitde', op: 'gt', value: 1 }]);
    expect('refusal' in typo && typo.refusal.code).toBe('UNKNOWN_FIELD');
    expect('refusal' in typo && typo.refusal.allowed).toContain('altitude');
    const op = readFilters(['flights'], [{ field: 'callsign', op: 'gt', value: 'A' }]);
    expect('refusal' in op && op.refusal.code).toBe('BAD_OPERATOR');
    const unit = readFilters(['flights'], [{ field: 'altitude', op: 'gt', value: '30 kn' }]);
    expect('refusal' in unit && unit.refusal.code).toBe('BAD_UNIT');
    const value = readFilters(['earthquakes'], [{ field: 'magnitude', op: 'gt', value: 'big' }]);
    expect('refusal' in value && value.refusal.code).toBe('BAD_VALUE');
    expect(readSort(['flights'], 'speed')).toEqual({ sortBy: 'speed' });
    expect('refusal' in readSort(['flights'], 'colour')).toBe(true);
  });
});

describe('running a query', () => {
  it('filters on typed fields across several layers and says when a count is a floor', () => {
    const f = readFilters(['flights', 'military_flights'], [{ field: 'altitude', op: 'gt', value: '20000 ft' }]);
    if (!('filters' in f)) throw new Error('refused');
    const res = runQuery(bag(), { layers: ['flights', 'military_flights'], filters: f.filters, sortBy: 'altitude' }, NOW);
    expect(res.items.map(e => e.id)).toEqual(['aa0001', 'ae1234']);
    expect(res.complete).toBe(false);
    expect(res.caveats[0]).toMatch(/ADS-B/);
    expect(res.total).toBe(4);
  });

  it('scopes to a region outline, a radius or the view, and measures from the centre', () => {
    const inTexas = runQuery(bag(), { layers: ['flights', 'military_flights'], scope: { kind: 'region', name: 'Texas', geometry: TEXAS } }, NOW);
    expect(inTexas.items.map(e => e.id).sort()).toEqual(['aa0003', 'ae1234']);
    const nearTokyo = runQuery(bag(), { layers: ['earthquakes'], scope: { kind: 'near', centre: { lat: 35.68, lng: 139.69 }, radiusKm: 600, name: 'Tokyo' } }, NOW);
    expect(nearTokyo.items.map(e => [e.id, e.km])).toEqual([['q1', 2], ['q2', 378]]);
    const inView = runQuery(bag(), { layers: ['earthquakes'], scope: { kind: 'view', bounds: { west: 135, south: 30, east: 140, north: 40 } } }, NOW);
    expect(inView.items.map(e => e.id)).toEqual(['q1']);
  });

  it('narrows the previous result on a follow-up, and sorts either way', () => {
    const first = runQuery(bag(), { layers: ['flights'], filters: [{ field: 'grounded', op: 'eq', value: false, type: 'flag' }] }, NOW);
    expect(first.keys).toEqual(expect.arrayContaining(['flights:aa0001', 'flights:aa0002']));
    const fastest = runQuery(bag(), { layers: ['flights'], among: new Set(first.keys), sortBy: 'speed', limit: 1 }, NOW);
    expect(fastest.items.map(e => e.id)).toEqual(['aa0001']);
    const slowest = runQuery(bag(), { layers: ['flights'], among: new Set(first.keys), sortBy: 'speed', sortDir: 'asc', limit: 1 }, NOW);
    expect(slowest.items.map(e => e.id)).toEqual(['aa0002']);
    const recent = runQuery(bag(), { layers: ['earthquakes'], filters: [{ field: 'age_h', op: 'lt', value: 2, type: 'number' }] }, NOW);
    expect(recent.items.map(e => e.id)).toEqual(['q1']);
    const emergencies = runQuery(bag(), { layers: ['flights'], filters: [{ field: 'emergency', op: 'eq', value: true, type: 'flag' }] }, NOW);
    expect(emergencies.items.map(e => e.title)).toEqual(['UAL9']);
  });
});

describe('geometry', () => {
  it('knows inside from outside, holes included, and draws great circles', () => {
    const ring: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]] };
    expect(inPolygon({ lat: 2, lng: 2 }, ring)).toBe(true);
    expect(inPolygon({ lat: 5, lng: 5 }, ring)).toBe(false);
    expect(inPolygon({ lat: 20, lng: 2 }, ring)).toBe(false);
    const line = greatCircle({ lat: 51.5, lng: -0.1 }, { lat: 40.6, lng: -73.8 }, 16);
    expect(line).toHaveLength(17);
    expect(line[8][1]).toBeGreaterThan(51.5);
    const across = greatCircle({ lat: 35, lng: 170 }, { lat: 35, lng: -170 }, 4);
    expect(Math.abs(across[4][0] - across[0][0])).toBeLessThan(30);
    expect(km({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111.2, 0);
  });
});
