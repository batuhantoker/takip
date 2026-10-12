import { describe, expect, it } from 'vitest';
import { apparentRaDec, AU_KM, gmstDeg, moonPhase, norm, orbitPath, positionAt, scale, sub, subPoint, wrap180 } from './astro';
import type { Vec3 } from './horizons';

// Heliocentric ecliptic-J2000 vectors from Horizons for 2026-10-12 00:00 TDB.
const EARTH: Vec3 = [1.417680100817214e8, 4.692595488201512e7, -3.327865611620247e3];
const EARTH_V: Vec3 = [-9.850309001562785, 2.817823641709606e1, -1.183370446517173e-3];
const MOON: Vec3 = [1.414442198529133e8, 4.670589029684494e7, -3.521694616975635e4];
const MARS: Vec3 = [-3.095266534468339e6, 2.350347253999861e8, 5.001362925057068e6];
const JD = 2461325.5;

describe('apparentRaDec', () => {
  // Horizons' own geocentric apparent RA/Dec for the same moment (quantity 2).
  it.each([
    ['Sun', scale(EARTH, -1), 197.23943, -7.32153, 0.02],
    ['Moon', sub(MOON, EARTH), 210.67964, -17.43228, 0.05],
    ['Mars', sub(MARS, EARTH), 130.71778, 19.44262, 0.05],
  ] as const)('places the %s within a few arcminutes of Horizons', (_name, geo, ra, dec, tol) => {
    const got = apparentRaDec(geo as Vec3, JD);
    expect(Math.abs(wrap180(got.ra - ra))).toBeLessThan(tol);
    expect(Math.abs(got.dec - dec)).toBeLessThan(tol);
  });
});

describe('gmstDeg and subPoint', () => {
  it('matches the J2000.0 sidereal time', () => {
    expect(gmstDeg(2451545)).toBeCloseTo(280.46061837, 6);
  });

  it('puts the Sun over the Pacific at 00:00 UTC in October', () => {
    const { ra, dec } = apparentRaDec(scale(EARTH, -1), JD);
    const p = subPoint(ra, dec, JD);
    // Mid-October the equation of time is about +13.5 min, so noon is ~3.4° east of 180°.
    expect(Math.abs(wrap180(p.lng - 176.6))).toBeLessThan(0.3);
    expect(p.lat).toBeCloseTo(-7.32, 1);
  });
});

describe('moonPhase', () => {
  it('reads the young crescent a day and a half after new moon', () => {
    const phase = moonPhase(scale(EARTH, -1), sub(MOON, EARTH));
    // Horizons: illuminated 2.08%, 16.6° from the Sun, trailing it into the evening sky.
    expect(phase.illumination).toBeCloseTo(0.0208, 2);
    expect(phase.waxing).toBe(true);
    expect(phase.elongation).toBeGreaterThan(12);
    expect(phase.elongation).toBeLessThan(20);
    expect(phase.name).toBe('New moon');
  });
});

describe('orbitPath', () => {
  it("closes Earth's orbit at about one astronomical unit", () => {
    const path = orbitPath(EARTH, EARTH_V)!;
    const radii = path.map(p => norm(p) / AU_KM);
    expect(Math.min(...radii)).toBeGreaterThan(0.98);
    expect(Math.max(...radii)).toBeLessThan(1.02);
    expect(norm(sub(path[0], path[path.length - 1]))).toBeLessThan(1);
  });

  it('has no loop for an escape trajectory', () => {
    expect(orbitPath([AU_KM, 0, 0], [0, 60, 0])).toBeNull();
  });
});

describe('positionAt', () => {
  const rows = [{ jd: 0, pos: [0, 0, 0] as Vec3 }, { jd: 1, pos: [10, 0, 0] as Vec3 }];
  it('interpolates between rows and clamps outside them', () => {
    expect(positionAt(rows, 0.25)).toEqual([2.5, 0, 0]);
    expect(positionAt(rows, 5)).toEqual([10, 0, 0]);
    expect(positionAt([], 0)).toBeNull();
  });
});
