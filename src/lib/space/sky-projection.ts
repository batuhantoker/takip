/**
 * TAKIP — the sky around MapLibre's globe.
 *
 * MapLibre's globe shader works on a unit sphere with axes
 *   (sin λ cos φ, sin φ, cos λ cos φ)
 * — y north, z through (0°, 0°) — and its projection matrix takes that sphere
 * to clip space. A star is a direction at infinity (w = 0), the Moon a point
 * 62 Earth radii out, so both go through the same matrix as the globe and line
 * up with it, parallax included.
 */

import { gmstDeg } from './astro';
import { matMul, precessionMatrix, type Mat3 } from './frames';
import type { Vec3 } from './horizons';

const DEG = Math.PI / 180;
export const EARTH_RADIUS_KM = 6371.0088;

/** Earth-fixed (x through 0°/0°, y through 0°/90°E, z north) to MapLibre's globe axes. */
const ECEF_TO_GLOBE: Mat3 = [0, 1, 0, 0, 0, 1, 1, 0, 0];

/** Equatorial of date to Earth-fixed at `jd`: undo Earth's spin. */
function ofDateToEcef(jd: number): Mat3 {
  const g = gmstDeg(jd) * DEG;
  return [Math.cos(g), Math.sin(g), 0, -Math.sin(g), Math.cos(g), 0, 0, 0, 1];
}

/** Equatorial of date to MapLibre's globe axes at `jd`. */
export function equatorialOfDateToGlobe(jd: number): Mat3 {
  return matMul(ECEF_TO_GLOBE, ofDateToEcef(jd));
}

/** J2000 equatorial (star catalogue) to MapLibre's globe axes at `jd`. */
export function j2000ToGlobe(jd: number): Mat3 {
  return matMul(equatorialOfDateToGlobe(jd), precessionMatrix(jd));
}

/**
 * J2000 equatorial to the sky over a map point, on MapLibre's mercator axes:
 * x east, y south, z up. Its mercator matrix takes x and y in world pixels but
 * z in metres, so z comes scaled by `upScale` (1 / pixels per metre).
 */
export function j2000ToLocalSky(jd: number, lat: number, lng: number, upScale = 1): Mat3 {
  const la = lat * DEG, lo = lng * DEG;
  const ecefToLocal: Mat3 = [
    -Math.sin(lo), Math.cos(lo), 0,
    Math.sin(la) * Math.cos(lo), Math.sin(la) * Math.sin(lo), -Math.cos(la),
    Math.cos(la) * Math.cos(lo) * upScale, Math.cos(la) * Math.sin(lo) * upScale, Math.sin(la) * upScale,
  ];
  return matMul(ecefToLocal, matMul(ofDateToEcef(jd), precessionMatrix(jd)));
}

export function raDecVector(raDeg: number, decDeg: number): Vec3 {
  const ra = raDeg * DEG, dec = decDeg * DEG;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

/** Column-major 4×4 (MapLibre's mainMatrix) times a homogeneous point. */
export function transform4(m: ArrayLike<number>, x: number, y: number, z: number, w: number): [number, number, number, number] {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12] * w,
    m[1] * x + m[5] * y + m[9] * z + m[13] * w,
    m[2] * x + m[6] * y + m[10] * z + m[14] * w,
    m[3] * x + m[7] * y + m[11] * z + m[15] * w,
  ];
}

/** CSS-pixel position of a homogeneous point, or null behind the camera. */
export function toScreen(m: ArrayLike<number>, p: [number, number, number, number], width: number, height: number): [number, number] | null {
  const c = transform4(m, ...p);
  if (c[3] <= 1e-9) return null;
  return [((c[0] / c[3] + 1) / 2) * width, ((1 - c[1] / c[3]) / 2) * height];
}

/** The camera's position in globe units: the point every projection ray starts from. */
export function cameraPosition(m: ArrayLike<number>): Vec3 | null {
  const inv = invert4(m);
  if (!inv) return null;
  const [x, y, z, w] = transform4(inv, 0, 0, 1, 0);
  return Math.abs(w) < 1e-12 ? null : [x / w, y / w, z / w];
}

/** Whether the unit globe stands between the camera and a direction (or a point `dist` away). */
export function hiddenByGlobe(cam: Vec3, dir: Vec3, dist = Infinity): boolean {
  const n = Math.hypot(dir[0], dir[1], dir[2]);
  const d: Vec3 = [dir[0] / n, dir[1] / n, dir[2] / n];
  const b = cam[0] * d[0] + cam[1] * d[1] + cam[2] * d[2];
  const c = cam[0] ** 2 + cam[1] ** 2 + cam[2] ** 2 - 1;
  const disc = b * b - c;
  if (disc <= 0) return false;
  const t = -b - Math.sqrt(disc);
  return t > 0 && t < dist;
}

export function invert4(m: ArrayLike<number>): number[] | null {
  const a = Array.from(m);
  const inv = new Array(16);
  inv[0] = a[5] * a[10] * a[15] - a[5] * a[11] * a[14] - a[9] * a[6] * a[15] + a[9] * a[7] * a[14] + a[13] * a[6] * a[11] - a[13] * a[7] * a[10];
  inv[4] = -a[4] * a[10] * a[15] + a[4] * a[11] * a[14] + a[8] * a[6] * a[15] - a[8] * a[7] * a[14] - a[12] * a[6] * a[11] + a[12] * a[7] * a[10];
  inv[8] = a[4] * a[9] * a[15] - a[4] * a[11] * a[13] - a[8] * a[5] * a[15] + a[8] * a[7] * a[13] + a[12] * a[5] * a[11] - a[12] * a[7] * a[9];
  inv[12] = -a[4] * a[9] * a[14] + a[4] * a[10] * a[13] + a[8] * a[5] * a[14] - a[8] * a[6] * a[13] - a[12] * a[5] * a[10] + a[12] * a[6] * a[9];
  inv[1] = -a[1] * a[10] * a[15] + a[1] * a[11] * a[14] + a[9] * a[2] * a[15] - a[9] * a[3] * a[14] - a[13] * a[2] * a[11] + a[13] * a[3] * a[10];
  inv[5] = a[0] * a[10] * a[15] - a[0] * a[11] * a[14] - a[8] * a[2] * a[15] + a[8] * a[3] * a[14] + a[12] * a[2] * a[11] - a[12] * a[3] * a[10];
  inv[9] = -a[0] * a[9] * a[15] + a[0] * a[11] * a[13] + a[8] * a[1] * a[15] - a[8] * a[3] * a[13] - a[12] * a[1] * a[11] + a[12] * a[3] * a[9];
  inv[13] = a[0] * a[9] * a[14] - a[0] * a[10] * a[13] - a[8] * a[1] * a[14] + a[8] * a[2] * a[13] + a[12] * a[1] * a[10] - a[12] * a[2] * a[9];
  inv[2] = a[1] * a[6] * a[15] - a[1] * a[7] * a[14] - a[5] * a[2] * a[15] + a[5] * a[3] * a[14] + a[13] * a[2] * a[7] - a[13] * a[3] * a[6];
  inv[6] = -a[0] * a[6] * a[15] + a[0] * a[7] * a[14] + a[4] * a[2] * a[15] - a[4] * a[3] * a[14] - a[12] * a[2] * a[7] + a[12] * a[3] * a[6];
  inv[10] = a[0] * a[5] * a[15] - a[0] * a[7] * a[13] - a[4] * a[1] * a[15] + a[4] * a[3] * a[13] + a[12] * a[1] * a[7] - a[12] * a[3] * a[5];
  inv[14] = -a[0] * a[5] * a[14] + a[0] * a[6] * a[13] + a[4] * a[1] * a[14] - a[4] * a[2] * a[13] - a[12] * a[1] * a[6] + a[12] * a[2] * a[5];
  inv[3] = -a[1] * a[6] * a[11] + a[1] * a[7] * a[10] + a[5] * a[2] * a[11] - a[5] * a[3] * a[10] - a[9] * a[2] * a[7] + a[9] * a[3] * a[6];
  inv[7] = a[0] * a[6] * a[11] - a[0] * a[7] * a[10] - a[4] * a[2] * a[11] + a[4] * a[3] * a[10] + a[8] * a[2] * a[7] - a[8] * a[3] * a[6];
  inv[11] = -a[0] * a[5] * a[11] + a[0] * a[7] * a[9] + a[4] * a[1] * a[11] - a[4] * a[3] * a[9] - a[8] * a[1] * a[7] + a[8] * a[3] * a[5];
  inv[15] = a[0] * a[5] * a[10] - a[0] * a[6] * a[9] - a[4] * a[1] * a[10] + a[4] * a[2] * a[9] + a[8] * a[1] * a[6] - a[8] * a[2] * a[5];
  const det = a[0] * inv[0] + a[1] * inv[4] + a[2] * inv[8] + a[3] * inv[12];
  if (Math.abs(det) < 1e-30) return null;
  return inv.map(v => v / det);
}

/** Star colour from its B−V index, blue-white through orange. */
export function starColor(bv: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, (bv + 0.3) / 2.0));
  return [0.72 + 0.28 * Math.min(1, t * 2), 0.8 + 0.2 * (1 - Math.abs(t - 0.35) * 1.6), 1 - 0.55 * t];
}
