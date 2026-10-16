import { describe, expect, it } from 'vitest';
import { viewPath } from './view-link';

describe('viewPath', () => {
  it('carries the place, zoom and the layers that are on, as use-startup.ts reads them', () => {
    const path = viewPath({ lat: 41.00823, lng: -28.97836, zoom: 9.5, layers: { flights: true, ships: true, cctv: false } });
    expect(path).toBe('/?lat=41.0082&lon=-28.9784&zoom=9.50&layers=flights%2Cships');
    const p = new URL(path, 'http://localhost').searchParams;
    expect([p.get('lat'), p.get('lon'), p.get('zoom'), p.get('layers')?.split(',')]).toEqual(['41.0082', '-28.9784', '9.50', ['flights', 'ships']]);
  });

  it('carries what the map follows, as use-startup.ts reads it back', () => {
    const path = viewPath({ lat: 1, lng: 2, zoom: 3, layers: {}, track: 'ship:271000001' });
    expect(new URL(path, 'http://localhost').searchParams.get('track')).toBe('ship:271000001');
    expect(viewPath({ lat: 1, lng: 2, zoom: 3, layers: {}, track: null })).not.toContain('track');
  });

  it('names no layers when none are on', () => {
    expect(viewPath({ lat: 0, lng: 0, zoom: 2, layers: { flights: false } })).toBe('/?lat=0.0000&lon=0.0000&zoom=2.00&layers=');
  });
});
