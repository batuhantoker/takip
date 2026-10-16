import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawnAt, routeGroup, routeTitle, routesAt, toLngLat } from './api';
import { toMercator } from './mercator';

afterEach(() => vi.unstubAllGlobals());

describe('toLngLat', () => {
  it('reprojects lines and multilines and drops everything else', () => {
    const a = toMercator(7.96, 46.6);
    const b = toMercator(7.97, 46.61);
    const fc = toLngLat({
      features: [
        { geometry: { type: 'LineString', coordinates: [a, b] } },
        { geometry: { type: 'MultiLineString', coordinates: [[a, b], [b, a]] } },
        { geometry: { type: 'Point', coordinates: a } },
        {},
      ],
    });
    expect(fc.features).toHaveLength(2);
    const line = fc.features[0].geometry as GeoJSON.LineString;
    expect(line.coordinates[0][0]).toBeCloseTo(7.96, 6);
    expect(line.coordinates[1][1]).toBeCloseTo(46.61, 6);
    expect((fc.features[1].geometry as GeoJSON.MultiLineString).coordinates[1][0][0]).toBeCloseTo(7.97, 6);
  });
});

describe('drawnAt', () => {
  it('names only the routes the overlay draws at that zoom', () => {
    expect(drawnAt('INT', 3)).toBe(true);
    expect(drawnAt('NAT', 3)).toBe(true);
    expect(drawnAt('REG', 5)).toBe(false);
    expect(drawnAt('REG', 7)).toBe(true);
    expect(drawnAt('AL2', 8)).toBe(true);
    expect(drawnAt('LOC', 9)).toBe(false);
    expect(drawnAt('LOC', 10)).toBe(true);
  });
});

describe('routeGroup and routeTitle', () => {
  it('labels known networks and falls back to the raw code', () => {
    expect(routeGroup('NAT').label).toBe('National');
    expect(routeGroup('AL4').label).toBe('Alpine trail');
    expect(routeGroup('NDS').label).toBe('NDS');
  });

  it('titles a route by name, then ref, then itinerary', () => {
    expect(routeTitle({ id: 1, name: 'Via Alpina', ref: 'VA' })).toBe('Via Alpina');
    expect(routeTitle({ id: 1, ref: 'E1' })).toBe('E1');
    expect(routeTitle({ id: 1, itinerary: ['Arvengarten', 'Männlichen'] })).toBe('Arvengarten – Männlichen');
    expect(routeTitle({ id: 7 })).toBe('Route 7');
  });
});

describe('routesAt', () => {
  it('asks for the box in whole metres and keeps well-formed results', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ results: [
      { type: 'relation', id: 19687570, group: 'AL2', itinerary: ['Arvengarten', 'Männlichen'] },
      { type: 'relation', id: 'x', group: 'LOC' },
      { type: 'relation', id: 5 },
    ] })));
    vi.stubGlobal('fetch', fetchMock);
    const found = await routesAt([884989.4, 5877026.6, 887216.2, 5878646.9]);
    expect(found.map(r => r.id)).toEqual([19687570]);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('bbox=884989,5877027,887216,5878647&limit=20');
  });
});
