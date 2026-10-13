import { describe, expect, it } from 'vitest';
import { add, norm, scale, sub } from './astro';
import { bodyDirection, iauOrientation, mul } from './frames';
import type { CraftHistory, Track } from './flight-history';
import { approxPosition } from './planets-approx';
import { LANDED_HOLD_DAYS, SURFACE_LIFT_KM } from './replay-landing';
import { ReplayModel } from './replay-model';
import { rateCap } from './replay-pacing';

const R_MARS = 3389.5;
const t0 = 2459200, td = 2459230;
const site = bodyDirection(18.44, 77.45);
// Straight down onto the site as it stood at touchdown, from three million km out over thirty days; then on the turning ground.
const rel = (jd: number): [number, number, number] => {
  const ground = mul(iauOrientation('mars', Math.max(jd, td)), scale(site, R_MARS + 1)) as [number, number, number];
  if (jd >= td) return ground;
  const k = (td - jd) / 30;
  return add(ground, scale(mul(iauOrientation('mars', td), site), 3e6 * k * k)) as [number, number, number];
};
const craftAt = (jd: number) => add(approxPosition('mars', jd), rel(jd));
const grid = (from: number, step: number, n: number, at: (jd: number) => number[]): Track => ({ t0: from, step, pos: Array.from({ length: n }, (_, i) => at(from + i * step)).flat() });

const coarse = grid(t0, 2, 31, craftAt);
const relTrack = { ...grid(t0 + 20, 2, 21, rel), vel: Array(63).fill(0) };
const HISTORY: CraftHistory = {
  id: -2, name: 'Lander', start: t0, end: t0 + 60, fetchedJd: t0 + 100, coarse,
  encounters: [{ kind: 'landing', body: 'mars', jd: td, km: R_MARS, craft: [grid(td - 2, 0.01, 241, craftAt)], bodyTrack: [grid(td - 2, 0.01, 241, jd => approxPosition('mars', jd))] }],
  phases: [{ body: 'mars', t0: t0 + 20, t1: t0 + 60, bodyTrack: null, rel: relTrack, landed: true, periodDays: null }],
  events: [{ jd: td, label: 'Lands on Mars', kind: 'landing' }, { jd: t0 + 100, label: 'Now', kind: 'now' }],
};

describe('a landing', () => {
  const m = new ReplayModel(HISTORY);
  const l = m.landing!;

  it('finds touchdown and the spot it came to rest on', () => {
    expect(l.jd).toBe(td);
    expect(l.lat).toBeCloseTo(18.44, 2);
    expect(l.lng).toBeCloseTo(77.45, 2);
    expect(norm(l.fixed)).toBeGreaterThanOrEqual(R_MARS + SURFACE_LIFT_KM - 1e-6);
  });

  it('comes down onto the spot without a jump and stays on it as Mars turns', () => {
    expect(norm(sub(m.craftAt(td - 1e-6), m.craftAt(td)))).toBeLessThan(5);
    for (const dt of [0.1, 0.4, 0.9]) {
      const t = td + dt;
      const want = add(m.bodyAt('mars', t), mul(iauOrientation('mars', t), l.fixed));
      expect(norm(sub(m.craftAt(t), want))).toBeLessThan(1e-6);
    }
    expect(m.landed(td + 0.1)).toBe(true);
    expect(m.landed(td - 0.1)).toBe(false);
  });

  it('flies the approach relative to Mars, and never under its ground', () => {
    for (let t = l.from; t < td; t += 0.05) {
      expect(norm(sub(m.craftAt(t), m.bodyAt('mars', t)))).toBeGreaterThanOrEqual(R_MARS + SURFACE_LIFT_KM - 1e-6);
    }
    expect(m.traceAt(td - 0.5)?.key).toBe(`landing:${td}`);
    expect(m.staying(td - 0.5)).toBe(true);
    expect(m.orbitAt(td - 0.5)).toBeNull();
  });

  it('ends a sol after touchdown, with what lies past it dropped', () => {
    expect(m.end).toBeCloseTo(td + LANDED_HOLD_DAYS, 9);
    expect(m.history.events.map(e => e.kind)).toEqual(['landing']);
    expect(m.history.end).toBeLessThan(m.history.fetchedJd);
  });

  it('draws the path in the Sun\'s frame only up to where the approach takes over', () => {
    const { jd } = m.path();
    expect(jd[jd.length - 1]).toBeCloseTo(l.from, 9);
  });

  it('slows into touchdown and holds the sol for a few seconds', () => {
    expect(rateCap(m, td - 1 / 1440)!).toBeLessThan(2 / 1440);
    expect(rateCap(m, td + 0.5)!).toBeCloseTo(LANDED_HOLD_DAYS / 8, 9);
  });
});
