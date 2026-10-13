/**
 * TAKIP — the 3D star catalogue (public/data/sky/nearby-stars.json, built by
 * tools/build-nearby-stars.mjs): every star to magnitude 5.5 and every Gaia
 * star within 100 light-years, at its measured distance.
 */

import { LY_KM, norm, scale } from './astro';
import { EQUATORIAL_TO_ECLIPTIC, mul } from './frames';
import type { Vec3 } from './horizons';

export interface NearbyStarCatalog {
  source: string;
  generated: string;
  /** [x, y, z] light-years from the Sun, J2000 equatorial; V magnitude from the Sun; B−V. */
  stars: [number, number, number, number, number][];
  ids: string[];
  names: Record<string, string>;
  asterisms: [number, number][];
  /** Stars with no usable parallax, parked at a nominal distance. */
  uncertain: number[];
}

const PC_LY = 3.26156;
export const SUN_ABS_MAG = 4.83;

export function starLy(s: NearbyStarCatalog['stars'][number]): number {
  return Math.hypot(s[0], s[1], s[2]);
}

/** Absolute V magnitude: how bright the star would look from 10 parsecs. */
export function absoluteMag(vmag: number, ly: number): number {
  return vmag - 5 * Math.log10(ly / PC_LY / 10);
}

/** How bright a star of absolute magnitude `abs` looks from `ly` away. */
export function apparentMag(abs: number, ly: number): number {
  return abs + 5 * Math.log10(Math.max(ly, 1e-9) / PC_LY / 10);
}

/** Scene position, heliocentric ecliptic km. */
export function starPosition(s: NearbyStarCatalog['stars'][number]): Vec3 {
  return scale(mul(EQUATORIAL_TO_ECLIPTIC, [s[0], s[1], s[2]]), LY_KM);
}

/** A rough spectral class from B−V, for the card. */
export function spectralClass(bv: number): string {
  if (bv < -0.2) return 'O/B · blue';
  if (bv < 0) return 'B · blue-white';
  if (bv < 0.3) return 'A · white';
  if (bv < 0.58) return 'F · yellow-white';
  if (bv < 0.81) return 'G · yellow';
  if (bv < 1.4) return 'K · orange';
  return 'M · red';
}

/** Ballesteros (2012): effective temperature from B−V. */
export function temperatureK(bv: number): number {
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
}

/** Distance between two catalogue points, light-years. */
export function separationLy(a: Vec3, b: Vec3): number {
  return norm([a[0] - b[0], a[1] - b[1], a[2] - b[2]]);
}
