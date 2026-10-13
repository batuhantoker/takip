import { describe, expect, it } from 'vitest';
import { norm, sub } from './astro';
import type { Vec3 } from './horizons';
import { approxPosition, moonGeocentric } from './planets-approx';
import type { SkyKey } from './sky';

// JPL Horizons, heliocentric ecliptic J2000, km; tolerances are twice Standish's stated errors.
const FIXTURES: [SkyKey, number, Vec3, number][] = [
  ['mercury', 2461325.5, [31991168, -56588608, -7558768], 20_000],
  ['venus', 2461325.5, [106433736, 20661273, -5857157], 30_000],
  ['earth', 2461325.5, [141768010, 46925955, -3328], 40_000],
  ['mars', 2461325.5, [-3095267, 235034725, 5001363], 100_000],
  ['jupiter', 2444032.5, [-563574510, 561978046, 10314175], 3_000_000],
  ['saturn', 2444555.5, [-1421315077, -53768882, 57407470], 8_000_000],
  ['uranus', 2446454.5, [-549165144, -2807444049, -3287998], 1_500_000],
  ['neptune', 2447763.5, [897558163, -4429309408, 70530070], 500_000],
  ['pluto', 2461325.5, [2991016002, -4391941294, -395097507], 1_500_000],
];

describe('approxPosition', () => {
  it.each(FIXTURES)('puts %s near Horizons on JD %d', (key, jd, horizons, tol) => {
    expect(norm(sub(approxPosition(key, jd), horizons))).toBeLessThan(tol);
  });
});

describe('moonGeocentric', () => {
  it('lands within a few thousand km of Horizons during Artemis I', () => {
    const moon: Vec3 = [85998887, 120326659, 28262], earth: Vec3 = [86341136, 120122148, -7088];
    expect(norm(sub(moonGeocentric(2459900.5), sub(moon, earth)))).toBeLessThan(6_000);
  });
});
