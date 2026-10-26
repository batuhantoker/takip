import { describe, expect, it } from 'vitest';
import { easeFor, markHighlight } from './marks';

const louvre = { id: 'Q19675', lon: 2.3376, lat: 48.8606, label: 'Louvre' };

describe('markHighlight', () => {
  it('marks only the named stop of a route, and draws no line of its own', () => {
    const h = markHighlight({ points: [louvre, { ...louvre, id: 'Q1', label: '' }], route: true });
    expect(h.points).toEqual([{ lat: louvre.lat, lng: louvre.lon, label: 'Louvre' }]);
    expect(h.lines).toBeUndefined();
    expect(h.quiet).toBe(true);
  });
});

describe('easeFor', () => {
  const paris = { west: 2.2, south: 48.8, east: 2.5, north: 48.95 };
  it('leaves a view that already shows the marks', () => {
    expect(easeFor([louvre], paris, 12)).toBeNull();
  });

  it('pans to a mark out of view at the same zoom', () => {
    expect(easeFor([{ ...louvre, lon: 2.7 }], paris, 12)).toEqual({ lat: louvre.lat, lng: 2.7, zoom: 12 });
  });

  it('zooms out, never in, to fit a route', () => {
    const to = easeFor([louvre, { ...louvre, lon: 3.1 }], paris, 12);
    expect(to!.zoom).toBeLessThan(12);
    expect(to!.lng).toBeCloseTo((louvre.lon + 3.1) / 2);
  });
});
