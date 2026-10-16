import { describe, it, expect } from 'vitest';
import { displayElevation, parseColor } from './points';

describe('displayElevation', () => {
  it('keeps the ordering of the orbital regimes', () => {
    // The compression must never reorder them: a GEO bird drawn below the ISS
    // would be worse than drawing everything on the ground.
    const leo = displayElevation(400);
    const meo = displayElevation(20200);
    const geo = displayElevation(35786);
    expect(leo).toBeLessThan(meo);
    expect(meo).toBeLessThan(geo);
  });

  it('compresses, so GEO stays on screen beside LEO', () => {
    // True to scale GEO is ~89x the ISS altitude, which cannot share a
    // viewport with the ground. Compressed it is single digits.
    const ratio = displayElevation(35786) / displayElevation(400);
    expect(35786 / 400).toBeGreaterThan(80);
    expect(ratio).toBeGreaterThan(2);
    expect(ratio).toBeLessThan(20);
  });

  it('lifts LEO clear of the surface rather than collapsing it', () => {
    // 400 km is 6% of an Earth radius; undisplaced it reads as ground clutter.
    expect(displayElevation(400)).toBeGreaterThan(400_000);
  });

  it('scales with the exaggeration control', () => {
    expect(displayElevation(400, 2)).toBeCloseTo(displayElevation(400, 1) * 2, 6);
    expect(displayElevation(400, 0)).toBe(0);
  });

  it('is safe on junk input', () => {
    expect(displayElevation(0)).toBe(0);
    expect(displayElevation(-100)).toBe(0);
    expect(displayElevation(NaN)).toBe(0);
    expect(displayElevation(Infinity)).toBe(0);
  });
});

describe('parseColor', () => {
  it('reads the catalogue hex colours', () => {
    expect(parseColor('#FF3D3D')).toBe(0xff3d3d);
    expect(parseColor('00E676')).toBe(0x00e676);
    expect(parseColor('#ffd700')).toBe(0xffd700);
  });

  it('falls back rather than producing NaN, which would blank the point', () => {
    expect(parseColor(undefined)).toBe(0x00e5ff);
    expect(parseColor('')).toBe(0x00e5ff);
    expect(parseColor('red')).toBe(0x00e5ff);
    expect(parseColor('#ff')).toBe(0x00e5ff);
  });
});
