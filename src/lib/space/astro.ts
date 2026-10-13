/**
 * TAKIP — the small amount of astronomy the space views need.
 *
 * Positions come from JPL Horizons as heliocentric vectors in the ecliptic of
 * J2000. Everything else — where a body is overhead, the Moon's phase, an
 * orbit to draw — is derived here, so one query per object serves every view.
 */

import type { Vec3 } from './horizons';

export const AU_KM = 149_597_870.7;
/** Julian light-year. */
export const LY_KM = 9_460_730_472_580.8;
export const LY_AU = LY_KM / AU_KM;
export const C_KM_S = 299_792.458;
export const GM_SUN = 1.32712440018e11;
const DEG = Math.PI / 180;
const OBLIQUITY_J2000 = 23.439291111 * DEG;

export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Between two points about a centre: the angle turned and the distance eased, so a blend round an orbit never cuts across it. */
export function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return lerp(a, b, t);
  const c = Math.max(-1, Math.min(1, dot(a, b) / (na * nb))), th = Math.acos(c);
  if (th < 1e-9 || Math.PI - th < 1e-6) return lerp(a, b, t);
  const s = Math.sin(th), ka = Math.sin((1 - t) * th) / (s * na), kb = Math.sin(t * th) / (s * nb), r = na + (nb - na) * t;
  return [(a[0] * ka + b[0] * kb) * r, (a[1] * ka + b[1] * kb) * r, (a[2] * ka + b[2] * kb) * r];
}

export function wrap180(deg: number): number {
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

export function wrap360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function eclipticToEquatorial(v: Vec3): Vec3 {
  const c = Math.cos(OBLIQUITY_J2000), s = Math.sin(OBLIQUITY_J2000);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
}

/** IAU 1976 precession, J2000 mean equator to mean equator of date. */
export function precessToDate(v: Vec3, jd: number): Vec3 {
  const t = (jd - 2451545) / 36525;
  const asec = DEG / 3600;
  const zeta = (2306.2181 * t + 0.30188 * t * t + 0.017998 * t ** 3) * asec;
  const z = (2306.2181 * t + 1.09468 * t * t + 0.018203 * t ** 3) * asec;
  const theta = (2004.3109 * t - 0.42665 * t * t - 0.041833 * t ** 3) * asec;
  const [cz, sz, cZ, sZ, ct, st] = [Math.cos(zeta), Math.sin(zeta), Math.cos(z), Math.sin(z), Math.cos(theta), Math.sin(theta)];
  return [
    (cz * ct * cZ - sz * sZ) * v[0] + (-sz * ct * cZ - cz * sZ) * v[1] + (-st * cZ) * v[2],
    (cz * ct * sZ + sz * cZ) * v[0] + (-sz * ct * sZ + cz * cZ) * v[1] + (-st * sZ) * v[2],
    (cz * st) * v[0] + (-sz * st) * v[1] + ct * v[2],
  ];
}

export function raDec(v: Vec3): { ra: number; dec: number } {
  return { ra: wrap360(Math.atan2(v[1], v[0]) / DEG), dec: Math.asin(v[2] / norm(v)) / DEG };
}

/** Greenwich mean sidereal time, degrees (IAU 1982; UT1 taken as UTC). */
export function gmstDeg(jd: number): number {
  const d = jd - 2451545;
  const t = d / 36525;
  return wrap360(280.46061837 + 360.98564736629 * d + 0.000387933 * t * t - (t * t * t) / 38710000);
}

/** The point on Earth with the body at its zenith. */
export function subPoint(ra: number, dec: number, jd: number): { lat: number; lng: number } {
  return { lat: dec, lng: wrap180(ra - gmstDeg(jd)) };
}

/** Right ascension and declination of date for a geocentric ecliptic-J2000 vector. */
export function apparentRaDec(geoEcliptic: Vec3, jd: number): { ra: number; dec: number } {
  return raDec(precessToDate(eclipticToEquatorial(geoEcliptic), jd));
}

export interface MoonPhase {
  /** Lit fraction of the disc, 0–1. */
  illumination: number;
  /** Moon's ecliptic longitude minus the Sun's, 0–360: 0 new, 180 full. */
  elongation: number;
  waxing: boolean;
  name: string;
}

const PHASE_NAMES = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];

/** Phase from geocentric ecliptic vectors of the Sun and the Moon. */
export function moonPhase(sunGeo: Vec3, moonGeo: Vec3): MoonPhase {
  const toSun = sub(sunGeo, moonGeo);
  const toEarth = scale(moonGeo, -1);
  const cosI = dot(toSun, toEarth) / (norm(toSun) * norm(toEarth));
  const elongation = wrap360((Math.atan2(moonGeo[1], moonGeo[0]) - Math.atan2(sunGeo[1], sunGeo[0])) / DEG);
  return {
    illumination: (1 + cosI) / 2,
    elongation,
    waxing: elongation < 180,
    name: PHASE_NAMES[Math.floor(wrap360(elongation + 22.5) / 45) % 8],
  };
}

/**
 * The osculating two-body orbit through a state, as `points` positions around
 * the focus. Null for an unbound (hyperbolic) path, which has no loop to draw.
 */
export function orbitPath(r: Vec3, v: Vec3, mu = GM_SUN, points = 180): Vec3[] | null {
  const rn = norm(r);
  const h = cross(r, v);
  const eVec = sub(scale(cross(v, h), 1 / mu), scale(r, 1 / rn));
  const e = norm(eVec);
  const energy = dot(v, v) / 2 - mu / rn;
  if (energy >= 0 || e >= 1) return null;
  const a = -mu / (2 * energy);
  const p = a * (1 - e * e);
  const w = scale(h, 1 / norm(h));
  const P = e > 1e-8 ? scale(eVec, 1 / e) : scale(r, 1 / rn);
  const Q = cross(w, P);
  const out: Vec3[] = [];
  for (let i = 0; i <= points; i++) {
    const nu = (i / points) * 2 * Math.PI;
    const rr = p / (1 + e * Math.cos(nu));
    out.push(add(scale(P, rr * Math.cos(nu)), scale(Q, rr * Math.sin(nu))));
  }
  return out;
}

/** Linear position at `jd` from rows sorted by time; clamps outside them. */
export function positionAt(rows: { jd: number; pos: Vec3 }[], jd: number): Vec3 | null {
  if (!rows.length) return null;
  if (jd <= rows[0].jd) return rows[0].pos;
  for (let i = 1; i < rows.length; i++) {
    if (jd <= rows[i].jd) {
      const a = rows[i - 1], b = rows[i];
      return lerp(a.pos, b.pos, (jd - a.jd) / (b.jd - a.jd));
    }
  }
  return rows[rows.length - 1].pos;
}
