import { describe, expect, it } from 'vitest';
import { apparentRaDec, eclipticToEquatorial, norm, scale, sub, subPoint } from './astro';
import { angleBetween, bodyDirection, drift, earthOrientation, EQUATORIAL_TO_ECLIPTIC, GM_EARTH, mul, orientationFromLighting, stateAt, triad } from './frames';
import type { StateRow, Vec3 } from './horizons';

// Horizons, 2026-10-12 00:00: heliocentric ecliptic-J2000 vectors, and the Moon's
// sub-Earth and sub-solar points (east longitude) at the same moment.
const EARTH: Vec3 = [1.417680100817214e8, 4.692595488201512e7, -3.327865611620247e3];
const MOON: Vec3 = [1.414442198529133e8, 4.670589029684494e7, -3.521694616975635e4];
const JD = 2461325.5;
const MOON_SUB_EARTH: [number, number] = [4.488999, 6.112257];
const MOON_SUB_SOLAR: [number, number] = [168.584839, -1.226666];

describe('EQUATORIAL_TO_ECLIPTIC', () => {
  it('undoes eclipticToEquatorial', () => {
    const v: Vec3 = [0.3, -0.5, 0.8];
    const back = mul(EQUATORIAL_TO_ECLIPTIC, eclipticToEquatorial(v));
    back.forEach((x, i) => expect(x).toBeCloseTo(v[i], 12));
  });
});

describe('earthOrientation', () => {
  it('turns the sub-solar point toward the Sun', () => {
    const toSun = scale(EARTH, -1);
    const { ra, dec } = apparentRaDec(toSun, JD);
    const p = subPoint(ra, dec, JD);
    const scene = mul(earthOrientation(JD), bodyDirection(p.lat, p.lng));
    expect(angleBetween(scene, toSun)).toBeLessThan(0.02);
  });

  it('keeps the north pole on the celestial pole, 23.4° from the ecliptic pole', () => {
    const pole = mul(earthOrientation(JD), [0, 0, 1]);
    expect(angleBetween(pole, [0, 0, 1])).toBeCloseTo(23.44, 1);
  });
});

describe('triad', () => {
  it('matches the first direction exactly and keeps the plane of the second', () => {
    const b1: Vec3 = [1, 0, 0], b2: Vec3 = [0, 1, 0];
    const s1: Vec3 = [0, 0, 1], s2: Vec3 = [1, 0, 0];
    const r = triad(b1, b2, s1, s2);
    expect(angleBetween(mul(r, b1), s1)).toBeLessThan(1e-9);
    expect(angleBetween(mul(r, b2), s2)).toBeLessThan(1e-9);
  });
});

describe('orientationFromLighting', () => {
  it("points the Moon's sub-Earth point at Earth and its sub-solar point at the Sun", () => {
    const r = orientationFromLighting(MOON_SUB_SOLAR, MOON_SUB_EARTH, MOON, EARTH);
    expect(angleBetween(mul(r, bodyDirection(MOON_SUB_EARTH[1], MOON_SUB_EARTH[0])), sub(EARTH, MOON))).toBeLessThan(1e-6);
    // Off only by what the two-vector fit cannot absorb: light time and aberration.
    expect(angleBetween(mul(r, bodyDirection(MOON_SUB_SOLAR[1], MOON_SUB_SOLAR[0])), scale(MOON, -1))).toBeLessThan(0.1);
  });
});

describe('stateAt', () => {
  it('follows a circular orbit between hourly samples to well under a kilometre', () => {
    const r = 384_400, w = 2 * Math.PI / (27.32 * 86_400);
    const row = (h: number): StateRow => {
      const a = w * h * 3600;
      return { jd: h / 24, pos: [r * Math.cos(a), r * Math.sin(a), 0], vel: [-r * w * Math.sin(a), r * w * Math.cos(a), 0] };
    };
    const got = stateAt([row(0), row(1)], 0.5 / 24)!;
    const want = row(0.5).pos;
    expect(norm(sub(got, want))).toBeLessThan(0.01);
  });
});

describe('drift', () => {
  it('bends a low orbit toward its centre', () => {
    const r = 7000, v = Math.sqrt(GM_EARTH / r);
    const p = drift([r, 0, 0], [0, v, 0], 60, GM_EARTH);
    expect(norm(p)).toBeCloseTo(r, -1);
  });
});
