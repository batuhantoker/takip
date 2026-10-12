import { describe, it, expect } from 'vitest';
import { decodePolyline } from './polyline';

describe('decodePolyline', () => {
  it('round-trips a known precision-6 shape to real coordinates', () => {
    // Friedrichstraße, Berlin — first vertex of a live Valhalla leg
    const pts = decodePolyline('chkdcBo`epXqGn@oEb@', 6);
    expect(pts.length).toBeGreaterThan(0);
    const [lng, lat] = pts[0];
    expect(lat).toBeCloseTo(52.517, 2);
    expect(lng).toBeCloseTo(13.3888, 2);
  });

  it('honours the precision argument', () => {
    const p6 = decodePolyline('chkdcBo`epX', 6)[0];
    const p5 = decodePolyline('chkdcBo`epX', 5)[0];
    expect(p5[0]).toBeCloseTo(p6[0] * 10, 4);
  });

  it('returns nothing for an empty shape', () => {
    expect(decodePolyline('', 6)).toEqual([]);
  });
});
