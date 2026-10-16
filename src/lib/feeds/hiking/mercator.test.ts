import { describe, expect, it } from 'vitest';
import { WORLD_HALF, boxContains, fromMercator, mercatorBox, toMercator } from './mercator';

describe('mercator', () => {
  it('round-trips lng/lat through EPSG:3857', () => {
    for (const [lng, lat] of [[7.96, 46.605], [-84.5, 39.1], [151.2, -33.9], [0, 0]]) {
      const [x, y] = toMercator(lng, lat);
      const [lng2, lat2] = fromMercator(x, y);
      expect(lng2).toBeCloseTo(lng, 9);
      expect(lat2).toBeCloseTo(lat, 9);
    }
  });

  it('matches the metres Waymarked Trails speaks', () => {
    const [x, y] = toMercator(7.95, 46.6);
    expect(x).toBeCloseTo(884990, 0);
    expect(y).toBeCloseTo(5877026, -1);
    expect(toMercator(180, 0)[0]).toBeCloseTo(WORLD_HALF, 3);
  });

  it('pads a box and keeps it on the world', () => {
    const tight = mercatorBox(7.9, 46.5, 8.0, 46.7);
    const padded = mercatorBox(7.9, 46.5, 8.0, 46.7, 0.5);
    expect(boxContains(padded, tight)).toBe(true);
    expect(boxContains(tight, padded)).toBe(false);
    expect(padded[2] - padded[0]).toBeCloseTo(2 * (tight[2] - tight[0]), 3);
    const world = mercatorBox(-180, -90, 180, 90, 1);
    expect(world.every(n => Math.abs(n) <= WORLD_HALF)).toBe(true);
  });

  it('orders corners given either way round', () => {
    expect(mercatorBox(8, 46.7, 7.9, 46.5)).toEqual(mercatorBox(7.9, 46.5, 8, 46.7));
  });
});
