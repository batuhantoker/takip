import { describe, it, expect } from 'vitest';
import { CLOUD_BASE_M, CLOUD_RELIEF_M, cloudAltitude, cloudLift, cloudOpacity, shadowOffset } from './altitude';
import { PAD, PADDED, TILE } from './tiles';
import { ancestorUv } from './layer';

describe('hanging the clouds', () => {
  it('puts low cloud at the base and the highest tops a full relief above it', () => {
    expect(cloudAltitude(0)).toBe(CLOUD_BASE_M);
    expect(cloudAltitude(1)).toBe(CLOUD_BASE_M + CLOUD_RELIEF_M);
    expect(cloudAltitude(7)).toBe(CLOUD_BASE_M + CLOUD_RELIEF_M);
  });

  it('draws the clouds whole from space and not at all at street level', () => {
    expect(cloudOpacity(2)).toBe(1);
    expect(cloudOpacity(6)).toBe(1);
    expect(cloudOpacity(11)).toBe(0);
    expect(cloudOpacity(15)).toBe(0);
  });

  it('lifts the deck more the further out the view, and not at all close in', () => {
    expect(cloudLift(6)).toBe(1);
    expect(cloudLift(9)).toBe(1);
    expect(cloudLift(4)).toBeGreaterThan(1);
    expect(cloudLift(0)).toBeLessThanOrEqual(2.5);
  });

  /* The complaint that started this: at town zoom the deck painted over every place. */
  it('thins them out on the way down', () => {
    let last = 1;
    for (let z = 6; z <= 11; z += 0.25) {
      expect(cloudOpacity(z)).toBeLessThanOrEqual(last);
      last = cloudOpacity(z);
    }
    expect(cloudOpacity(8.5)).toBeLessThan(0.6);
  });

  it('casts a shadow that reaches further across a tile the closer in the tile is', () => {
    expect(shadowOffset(6, 0) / shadowOffset(5, 0)).toBeCloseTo(2);
  });

  // A tile is narrower on the ground toward the poles, so the same reach covers more of it.
  it('casts it further across a tile at high latitude', () => {
    expect(shadowOffset(5, Math.PI / 3)).toBeGreaterThan(shadowOffset(5, 0));
  });

  it('draws a tile on its own texture across the inner square, inside the margin', () => {
    expect(ancestorUv(5, 9, 0)).toEqual([PAD / PADDED, PAD / PADDED, TILE / PADDED, TILE / PADDED]);
  });

  it('draws a tile on its parent’s texture over the right quarter', () => {
    // 3, 2 at one level down is the parent's east half, north half.
    const [ox, oy, sx, sy] = ancestorUv(3, 2, 1);
    expect(ox).toBeCloseTo((PAD + TILE / 2) / PADDED);
    expect(oy).toBeCloseTo(PAD / PADDED);
    expect(sx).toBeCloseTo(TILE / 2 / PADDED);
    expect(sy).toBeCloseTo(TILE / 2 / PADDED);
  });
});
