import { LAND_MASK } from './land-mask';

export const DEG = Math.PI / 180;

/** Points on the unit sphere, as typed arrays so the frame loop allocates nothing. */
export interface SpherePoints {
  count: number;
  lon: Float32Array;
  cosLat: Float32Array;
  sinLat: Float32Array;
  /** 0..1 per point, for staggering the reveal. */
  seed: Float32Array;
}

/** Where the camera looks from: the longitude facing the viewer and the latitude it hovers over. */
export interface View {
  lon0: number;
  sinTilt: number;
  cosTilt: number;
}

export interface OrbitShape {
  /** Orbit radius, in globe radii. */
  radius: number;
  /** Screen angle of the long axis; positive rises to the right. */
  tilt: number;
  /** How open the ellipse looks: minor / major axis. */
  open: number;
}

function decodeMask(): Uint8Array {
  const raw = atob(LAND_MASK.bits);
  const bits = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bits[i] = raw.charCodeAt(i);
  return bits;
}

const hash = (i: number) => {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

/** Fibonacci-sphere samples that fall on land; evenly spaced, unlike a lat/lng grid that bunches at the poles. */
export function landPoints(samples: number): SpherePoints {
  const bits = decodeMask();
  const { cols, rows } = LAND_MASK;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const keep: number[] = [];
  for (let i = 0; i < samples; i++) {
    const lat = Math.asin(1 - (2 * i + 1) / samples) / DEG;
    const lon = ((((i * golden) / DEG) % 360) + 360) % 360 - 180;
    const c = Math.min(cols - 1, Math.floor(((lon + 180) / 360) * cols));
    const r = Math.min(rows - 1, Math.floor(((90 - lat) / 180) * rows));
    const k = r * cols + c;
    if (bits[k >> 3] & (1 << (k & 7))) keep.push(i);
  }
  const n = keep.length;
  const pts: SpherePoints = {
    count: n,
    lon: new Float32Array(n),
    cosLat: new Float32Array(n),
    sinLat: new Float32Array(n),
    seed: new Float32Array(n),
  };
  keep.forEach((i, j) => {
    const sinLat = 1 - (2 * i + 1) / samples;
    pts.sinLat[j] = sinLat;
    pts.cosLat[j] = Math.sqrt(1 - sinLat * sinLat);
    pts.lon[j] = ((i * golden) % (2 * Math.PI)) - Math.PI;
    pts.seed[j] = hash(i);
  });
  return pts;
}

export const makeView = (lon0: number, tilt: number): View => ({ lon0, sinTilt: Math.sin(tilt), cosTilt: Math.cos(tilt) });

/** Orthographic projection in globe radii: x east, y down the screen, z > 0 faces the viewer. */
export function project(lon: number, lat: number, v: View): [number, number, number] {
  const d = lon - v.lon0;
  const cl = Math.cos(lat);
  const sl = Math.sin(lat);
  const z0 = cl * Math.cos(d);
  return [cl * Math.sin(d), -(sl * v.cosTilt - z0 * v.sinTilt), sl * v.sinTilt + z0 * v.cosTilt];
}

/** Screen offset (globe radii, y down) and depth (> 0 in front) of the orbit at angle a; the lower half passes in front. */
export function orbitAt(a: number, o: OrbitShape): [number, number, number] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const ux = Math.cos(o.tilt);
  const uy = Math.sin(o.tilt);
  const x = o.radius * (c * ux - s * o.open * uy);
  const y = o.radius * (c * uy + s * o.open * ux);
  return [x, -y, -o.radius * s * Math.sqrt(1 - o.open * o.open)];
}

/** The point the sun is overhead, to within a degree or two (no equation of time). */
export function subsolar(date: Date): { lat: number; lon: number } {
  const day = (date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 0)) / 864e5;
  const lat = -23.44 * DEG * Math.cos(((2 * Math.PI) / 365) * (day + 10));
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60;
  return { lat, lon: (12 - hours) * 15 * DEG };
}

/** Cosine of the sun's zenith angle at a point: > 0 in daylight. */
export function sunDot(lon: number, cosLat: number, sinLat: number, sun: { lat: number; lon: number }): number {
  return cosLat * Math.cos(sun.lat) * Math.cos(lon - sun.lon) + sinLat * Math.sin(sun.lat);
}
