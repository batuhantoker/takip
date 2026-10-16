import { describe, expect, it } from 'vitest';
import { norm, sub } from '../astro';
import { GM_EARTH } from '../frames';
import { period, propagate } from './two-body';

describe('propagate', () => {
  it('carries a circular orbit a quarter turn in a quarter period', () => {
    const r = 7000, v = Math.sqrt(GM_EARTH / r);
    const T = period([r, 0, 0], [0, v, 0], GM_EARTH);
    const s = propagate([r, 0, 0], [0, v, 0], T / 4, GM_EARTH);
    expect(s.r[0]).toBeCloseTo(0, 3);
    expect(s.r[1]).toBeCloseTo(r, 3);
  });

  it('comes back round an eccentric orbit, and runs backwards too', () => {
    const r0: [number, number, number] = [9000, 0, 0], v0: [number, number, number] = [0, 8.5, 1.2];
    const T = period(r0, v0, GM_EARTH);
    expect(norm(sub(propagate(r0, v0, T, GM_EARTH).r, r0))).toBeLessThan(1e-3);
    const back = propagate(r0, v0, -T / 3, GM_EARTH);
    expect(norm(sub(propagate(back.r, back.v, T / 3, GM_EARTH).r, r0))).toBeLessThan(1e-3);
  });

  it('stays on an eccentric orbit at every moment, either way in time', () => {
    const GM_MARS = 42_828;
    // MRO in its first orbit at Mars, as Horizons gave it; plain Newton flew off at a few dozen of these moments.
    const r0: [number, number, number] = [16_171, 586, 23_190], v0: [number, number, number] = [0.25047, -0.44448, 1.06136];
    const energy = (r: number[], v: number[]) => (v[0] ** 2 + v[1] ** 2 + v[2] ** 2) / 2 - GM_MARS / Math.hypot(r[0], r[1], r[2]);
    const e0 = energy(r0, v0);
    for (let dt = -112_000; dt <= 112_000; dt += 2) {
      const s = propagate(r0, v0, dt, GM_MARS);
      expect(Math.abs(energy(s.r, s.v) / e0 - 1)).toBeLessThan(1e-6);
    }
  });

  it('keeps a hyperbolic flyby\'s energy', () => {
    const energy = (r: number[], v: number[]) => (v[0] ** 2 + v[1] ** 2 + v[2] ** 2) / 2 - GM_EARTH / Math.hypot(r[0], r[1], r[2]);
    const s = propagate([7000, 0, 0], [0, 12, 0], 3600, GM_EARTH);
    expect(energy(s.r, s.v)).toBeCloseTo(energy([7000, 0, 0], [0, 12, 0]), 6);
    expect(norm(s.r)).toBeGreaterThan(25_000);
    expect(period([7000, 0, 0], [0, 12, 0], GM_EARTH)).toBe(Infinity);
  });
});
