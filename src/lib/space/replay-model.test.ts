import { describe, expect, it } from 'vitest';
import { add, norm, sub } from './astro';
import { bodyDirection, earthOrientation, iauOrientation, mul } from './frames';
import type { CraftHistory, Track } from './flight-history';
import { approxPosition } from './planets-approx';
import { ReplayModel } from './replay-model';

const line = (t0: number, step: number, n: number, at: (jd: number) => [number, number, number]): Track =>
  ({ t0, step, pos: Array.from({ length: n }, (_, i) => at(t0 + i * step)).flat() });

// A craft moving 1,000 km a day along x, with a fine stretch through day 50 near Jupiter.
const move = (jd: number): [number, number, number] => [(jd - 1000) * 1000, 0, 0];
const jupiterExact = (jd: number): [number, number, number] => {
  const a = approxPosition('jupiter', jd);
  return [a[0] + 5e6, a[1], a[2]];
};
const HISTORY: CraftHistory = {
  id: -1, name: 'Test', start: 1000, end: 1100, fetchedJd: 1080,
  coarse: line(1000, 10, 11, move),
  encounters: [{ kind: 'flyby', body: 'jupiter', jd: 1050, km: 1e5, craft: [line(1040, 0.5, 41, move)], bodyTrack: [line(1040, 0.5, 41, jupiterExact)] }],
  phases: [],
  events: [],
};

describe('ReplayModel', () => {
  const m = new ReplayModel(HISTORY);

  it('places the craft from its tracks and clamps outside the flight', () => {
    expect(m.craftAt(1050.25)[0]).toBeCloseTo(50_250, 3);
    expect(m.craftAt(900)).toEqual(m.craftAt(1000));
  });

  it('glides a body onto its exact track through an encounter and off it after', () => {
    expect(norm(sub(m.bodyAt('jupiter', 1050), jupiterExact(1050)))).toBeLessThan(1);
    expect(norm(sub(m.bodyAt('jupiter', 1070), approxPosition('jupiter', 1070)))).toBeLessThan(1);
    const halfway = norm(sub(m.bodyAt('jupiter', 1042), approxPosition('jupiter', 1042)));
    expect(halfway).toBeGreaterThan(0);
    expect(halfway).toBeLessThan(5e6);
  });

  it('reads speed and the stretch to slow down for', () => {
    expect(m.speedAt(1050)).toBeCloseTo(1000 / 86_400, 6);
    expect(m.stretchAt(1050)).toBe(20);
    expect(m.stretchAt(1090)).toBeNull();
  });

  it('draws the path from the finest samples, in order', () => {
    const { jd, pos } = m.path();
    expect(jd.length).toBe(11 - 3 + 41);
    for (let i = 1; i < jd.length; i++) expect(jd[i]).toBeGreaterThan(jd[i - 1]);
    expect(pos.length).toBe(jd.length * 3);
  });
});

describe('track edges', () => {
  it('reads the last moment of a track despite rounding', () => {
    const m = new ReplayModel({ ...HISTORY, end: 1000 + 10 * 10 + 1e-9 });
    expect(m.craftAt(m.end)).toEqual([100_000, 0, 0]);
  });
});

describe('stays', () => {
  const GM_MARS = 42_828;
  const step = 2;
  const n = 20;
  const t0 = 2459000;
  // A lander at a fixed body-fixed spot, sampled every two days as Horizons would give it.
  const fixedSpot: [number, number, number] = [3391, 0, 0];
  const landedRel = Array.from({ length: n }, (_, i) => mul(iauOrientation('mars', t0 + i * step), fixedSpot)).flat();
  const orbitR = 3800, orbitV = Math.sqrt(GM_MARS / orbitR);
  const orbitRel = Array.from({ length: n }, () => [orbitR, 0, 0]).flat();
  const stay = (landed: boolean, pos: number[], vel: number[]) => ({
    body: 'mars' as const, t0, t1: t0 + (n - 1) * step, bodyTrack: null, landed, periodDays: landed ? null : 0.08,
    rel: { t0, step, pos, vel },
  });
  const history = (p: ReturnType<typeof stay>): CraftHistory => ({
    ...HISTORY, start: t0, end: t0 + (n - 1) * step, coarse: line(t0, step, n, () => [0, 0, 0]), encounters: [], phases: [p],
  });

  it('keeps a lander on its spot as Mars turns between samples', () => {
    const m = new ReplayModel(history(stay(true, landedRel, Array(n * 3).fill(0))));
    const t = t0 + 7.3;
    const want = add(m.bodyAt('mars', t), mul(iauOrientation('mars', t), fixedSpot));
    expect(norm(sub(m.craftAt(t), want))).toBeLessThan(1);
  });

  it('carries an orbiter round its orbit instead of joining samples', () => {
    const vel = Array.from({ length: n }, () => [0, orbitV, 0]).flat();
    const m = new ReplayModel(history(stay(false, orbitRel, vel)));
    for (const dt of [0.3, 0.71, 1.02]) {
      const t = t0 + 4 + dt;
      expect(norm(sub(m.craftAt(t), m.bodyAt('mars', t)))).toBeCloseTo(orbitR, 0);
    }
    expect(m.orbitAt(t0 + 4.2)?.points.length).toBeGreaterThan(100);
    expect(m.path().jd.length).toBeLessThan(n);
  });
});

describe('ascent', () => {
  const t0 = 2459000;
  const start = t0 + 1 / 24;
  const earthAt = (jd: number): [number, number, number] => { const e = approxPosition('earth', jd); return [e[0], e[1], e[2]]; };
  // Horizons begins an hour after launch, 12,000 km out and climbing at 9 km/s.
  const first = (jd: number): [number, number, number] => { const e = earthAt(jd); return [e[0] + 12_000 + (jd - start) * 86_400 * 9, e[1] + 3_000, e[2]]; };
  const fineCraft = line(start, 1 / 1440, 60, first);
  const fineEarth = line(start, 1 / 1440, 60, earthAt);
  const m = new ReplayModel({
    ...HISTORY, start, end: start + 10, coarse: line(start, 1, 11, first), phases: [],
    launch: { jd: t0, lat: 28.5, lng: -80.6, pad: 'Test pad', vehicle: 'Test' },
    encounters: [{ kind: 'launch', body: 'earth', jd: start, km: 12_000, craft: [fineCraft], bodyTrack: [fineEarth] }],
  });

  it('starts on the pad and meets Horizons where it begins', () => {
    expect(m.start).toBe(t0);
    const pad = mul(earthOrientation(t0), bodyDirection(28.5, -80.6));
    expect(norm(sub(m.craftAt(t0), add(m.bodyAt('earth', t0), [pad[0] * 6371, pad[1] * 6371, pad[2] * 6371])))).toBeLessThan(1);
    expect(norm(sub(m.craftAt(start - 1e-7), m.craftAt(start)))).toBeLessThan(50);
  });

  it('never goes below the ground on the way up', () => {
    for (let i = 0; i <= 50; i++) {
      const t = t0 + (i / 50) * (start - t0);
      expect(norm(sub(m.craftAt(t), m.bodyAt('earth', t)))).toBeGreaterThan(6370);
    }
  });
});
