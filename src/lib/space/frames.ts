/**
 * TAKIP — putting everything into one frame: heliocentric, ecliptic of J2000,
 * kilometres — the frame Horizons' vectors arrive in.
 *
 * Body-fixed frames here are x through (0°, 0°), y through (0°, 90°E), z the
 * north pole. A body's orientation is a 3×3 row-major matrix taking body-fixed
 * vectors to the scene frame.
 */

import { cross, dot, gmstDeg, norm, scale, sub } from './astro';
import type { StateRow, Vec3 } from './horizons';

export type Mat3 = [number, number, number, number, number, number, number, number, number];

const DEG = Math.PI / 180;
const OBLIQUITY_J2000 = 23.439291111 * DEG;

export function mul(m: Mat3, v: Vec3): Vec3 {
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
}

export function matMul(a: Mat3, b: Mat3): Mat3 {
  const out = new Array(9) as Mat3;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return out;
}

export function transpose(m: Mat3): Mat3 {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

const unit = (v: Vec3): Vec3 => scale(v, 1 / norm(v));

/** Equatorial J2000 to ecliptic J2000. */
export const EQUATORIAL_TO_ECLIPTIC: Mat3 = (() => {
  const c = Math.cos(OBLIQUITY_J2000), s = Math.sin(OBLIQUITY_J2000);
  return [1, 0, 0, 0, c, s, 0, -s, c];
})();

/** IAU 1976 precession, mean equator of J2000 to mean equator of date. */
export function precessionMatrix(jd: number): Mat3 {
  const t = (jd - 2451545) / 36525;
  const asec = DEG / 3600;
  const zeta = (2306.2181 * t + 0.30188 * t * t + 0.017998 * t ** 3) * asec;
  const z = (2306.2181 * t + 1.09468 * t * t + 0.018203 * t ** 3) * asec;
  const theta = (2004.3109 * t - 0.42665 * t * t - 0.041833 * t ** 3) * asec;
  const [cz, sz, cZ, sZ, ct, st] = [Math.cos(zeta), Math.sin(zeta), Math.cos(z), Math.sin(z), Math.cos(theta), Math.sin(theta)];
  return [
    cz * ct * cZ - sz * sZ, -sz * ct * cZ - cz * sZ, -st * cZ,
    cz * ct * sZ + sz * cZ, -sz * ct * sZ + cz * cZ, -st * sZ,
    cz * st, -sz * st, ct,
  ];
}

/** Earth-fixed to scene: spin by sidereal time, undo precession, tilt to the ecliptic. */
export function earthOrientation(jd: number): Mat3 {
  const g = gmstDeg(jd) * DEG;
  const spin: Mat3 = [Math.cos(g), -Math.sin(g), 0, Math.sin(g), Math.cos(g), 0, 0, 0, 1];
  return matMul(EQUATORIAL_TO_ECLIPTIC, matMul(transpose(precessionMatrix(jd)), spin));
}

/** Unit vector, body-fixed, toward east longitude `lng` and latitude `lat`. */
export function bodyDirection(lat: number, lng: number): Vec3 {
  const la = lat * DEG, lo = lng * DEG;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
}

/** A point `altKm` above a sphere of `radiusKm`, body-fixed. */
export function bodyPoint(lat: number, lng: number, altKm: number, radiusKm: number): Vec3 {
  return scale(bodyDirection(lat, lng), radiusKm + altKm);
}

/**
 * TRIAD: the rotation taking body-fixed directions to scene directions, from
 * two directions known in both frames. The first pair is matched exactly.
 */
export function triad(body1: Vec3, body2: Vec3, scene1: Vec3, scene2: Vec3): Mat3 {
  const basis = (a: Vec3, b: Vec3): [Vec3, Vec3, Vec3] => {
    const t1 = unit(a);
    const t2 = unit(cross(a, b));
    return [t1, t2, cross(t1, t2)];
  };
  const [b1, b2, b3] = basis(body1, body2);
  const [s1, s2, s3] = basis(scene1, scene2);
  // R = [s1 s2 s3] · [b1 b2 b3]ᵀ
  const out = new Array(9) as Mat3;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out[r * 3 + c] = s1[r] * b1[c] + s2[r] * b2[c] + s3[r] * b3[c];
  return out;
}

/** Orientation of a body from where the Sun and Earth stand overhead on it. */
export function orientationFromLighting(
  subSolar: [number, number], subEarth: [number, number],
  bodyHelio: Vec3, earthHelio: Vec3,
): Mat3 {
  return triad(
    bodyDirection(subEarth[1], subEarth[0]), bodyDirection(subSolar[1], subSolar[0]),
    sub(earthHelio, bodyHelio), scale(bodyHelio, -1),
  );
}

/** Cubic Hermite position between hourly states; clamps outside them. */
export function stateAt(rows: StateRow[], jd: number): Vec3 | null {
  if (!rows.length) return null;
  if (jd <= rows[0].jd) return rows[0].pos;
  const last = rows[rows.length - 1];
  if (jd >= last.jd) return last.pos;
  const i = rows.findIndex(r => r.jd >= jd);
  const a = rows[i - 1], b = rows[i];
  const dt = (b.jd - a.jd) * 86_400;
  const s = (jd - a.jd) / (b.jd - a.jd);
  const s2 = s * s, s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  return [0, 1, 2].map(k => h00 * a.pos[k] + h10 * dt * a.vel[k] + h01 * b.pos[k] + h11 * dt * b.vel[k]) as Vec3;
}

export const GM_EARTH = 398_600.4418;

/** Position `dtSec` after a state, about a centre of mass `mu`: Taylor series to the gravity term. */
export function drift(pos: Vec3, vel: Vec3, dtSec: number, mu: number): Vec3 {
  const r = norm(pos);
  const g = -mu / (2 * r * r * r);
  return [0, 1, 2].map(k => pos[k] + vel[k] * dtSec + g * pos[k] * dtSec * dtSec) as Vec3;
}

export function angleBetween(a: Vec3, b: Vec3): number {
  return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (norm(a) * norm(b))))) / DEG;
}
