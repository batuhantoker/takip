/**
 * TAKIP — the Milky Way around the Sun: where its centre is, in the scene
 * frame, from the IAU galactic axes and the measured distance to Sgr A*.
 */

import { LY_KM, scale } from '../astro';
import { GALACTIC_TO_ECLIPTIC, mul } from '../frames';
import type { Vec3 } from '../horizons';

/** Sun to Sgr A*: 8.178 kpc (GRAVITY Collaboration 2019). */
export const GALACTIC_CENTRE_LY = 26_670;

/** Sgr A*, heliocentric ecliptic J2000, km. */
export const GALACTIC_CENTRE_KM: Vec3 = scale(mul(GALACTIC_TO_ECLIPTIC, [1, 0, 0]), GALACTIC_CENTRE_LY * LY_KM);

/** The north galactic pole as a scene direction. */
export const GALACTIC_NORTH: Vec3 = mul(GALACTIC_TO_ECLIPTIC, [0, 0, 1]);

/** The disc's stellar radius, near enough for a camera to take in all of it. */
export const DISC_RADIUS_LY = 50_000;
