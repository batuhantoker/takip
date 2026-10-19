/**
 * Corrected geomagnetic latitude, as AACGM defines it: follow the IGRF field line from the ground to the
 * dipole's equatorial plane, then back down a dipole line from that distance. It agreed with aacgmv2 2.7
 * to 0.1° for 25 test cities; the plain dipole was off by up to 6° (London, Edinburgh) and the eccentric
 * dipole by up to 4° (Minneapolis). tools/site/topics/sky.ts runs it once per place, with IGRF-14.
 */

const RAD = Math.PI / 180;
const IGRF_RADIUS_KM = 6371.2;
const WGS84_A = 6378.137;
const WGS84_B = 6356.752;

/** Schmidt semi-normalised Gauss coefficients in nT, g[n][m] and h[n][m], for one decimal year. */
export interface Igrf { degree: number; g: Float64Array[]; h: Float64Array[] }

type Vec = [number, number, number];

/**
 * NOAA NCEI's igrf14coeffs.txt, extrapolated from its last model with the secular variation beside it.
 * Its last two columns are the newest model (2025.0) and that change per year.
 */
export function parseIgrf(text: string, year: number): Igrf {
  const rows = text.split('\n').filter(l => /^[gh]\s/.test(l)).map(l => l.trim().split(/\s+/));
  const head = text.split('\n').find(l => /^g\/h\s/.test(l))?.trim().split(/\s+/) ?? [];
  const base = Number(head[head.length - 2]);
  if (!rows.length || !Number.isFinite(base)) throw new Error('IGRF: unexpected coefficient file');
  const degree = Math.max(...rows.map(r => Number(r[1])));
  const g = Array.from({ length: degree + 1 }, (_, n) => new Float64Array(n + 1));
  const h = Array.from({ length: degree + 1 }, (_, n) => new Float64Array(n + 1));
  for (const r of rows) {
    const n = Number(r[1]), m = Number(r[2]);
    (r[0] === 'g' ? g : h)[n][m] = Number(r[r.length - 2]) + Number(r[r.length - 1]) * (year - base);
  }
  return { degree, g, h };
}

/** Schmidt semi-normalised P(n, m) of cos θ and its θ derivative. */
function legendre(degree: number, theta: number) {
  const c = Math.cos(theta), s = Math.sin(theta);
  const P = Array.from({ length: degree + 1 }, (_, n) => new Float64Array(n + 1));
  const dP = Array.from({ length: degree + 1 }, (_, n) => new Float64Array(n + 1));
  P[0][0] = 1;
  for (let n = 1; n <= degree; n++) {
    for (let m = 0; m <= n; m++) {
      if (m === n) {
        const k = n === 1 ? 1 : Math.sqrt((2 * n - 1) / (2 * n));
        P[n][n] = k * s * P[n - 1][n - 1];
        dP[n][n] = k * (s * dP[n - 1][n - 1] + c * P[n - 1][n - 1]);
      } else {
        const k1 = (2 * n - 1) / Math.sqrt(n * n - m * m);
        const k2 = n - 2 >= m ? Math.sqrt(((n - 1) * (n - 1) - m * m) / (n * n - m * m)) : 0;
        P[n][m] = k1 * c * P[n - 1][m] - (k2 ? k2 * P[n - 2][m] : 0);
        dP[n][m] = k1 * (c * dP[n - 1][m] - s * P[n - 1][m]) - (k2 ? k2 * dP[n - 2][m] : 0);
      }
    }
  }
  return { P, dP };
}

/** The main field in Earth-centred Cartesian components, at a point given in IGRF radii (6371.2 km). */
export function igrfField(model: Igrf, [x, y, z]: Vec): Vec {
  const r = Math.hypot(x, y, z), theta = Math.acos(z / r), phi = Math.atan2(y, x);
  const { P, dP } = legendre(model.degree, theta);
  const st = Math.max(Math.sin(theta), 1e-9);
  let br = 0, bt = 0, bp = 0;
  for (let n = 1; n <= model.degree; n++) {
    const f = (1 / r) ** (n + 2);
    for (let m = 0; m <= n; m++) {
      const cm = Math.cos(m * phi), sm = Math.sin(m * phi);
      const g = model.g[n][m], h = model.h[n][m];
      br += (n + 1) * f * (g * cm + h * sm) * P[n][m];
      bt -= f * (g * cm + h * sm) * dP[n][m];
      bp -= (f * m * (h * cm - g * sm) * P[n][m]) / st;
    }
  }
  const ct = Math.cos(theta), cp = Math.cos(phi), sp = Math.sin(phi);
  return [br * st * cp + bt * ct * cp - bp * sp, br * st * sp + bt * ct * sp + bp * cp, br * ct - bt * st];
}

/** A point on the WGS84 ellipsoid, in IGRF radii. */
function ground(lat: number, lng: number): Vec {
  const sl = Math.sin(lat * RAD), cl = Math.cos(lat * RAD);
  const rho = Math.hypot(WGS84_A * cl, WGS84_B * sl);
  const p = (WGS84_A * WGS84_A * cl) / rho / IGRF_RADIUS_KM;
  return [p * Math.cos(lng * RAD), p * Math.sin(lng * RAD), (WGS84_B * WGS84_B * sl) / rho / IGRF_RADIUS_KM];
}

const MAX_RADII = 40;

/** Degrees, negative in the south; ±90 for a line that runs out past 40 Earth radii. */
export function magneticLatitude(model: Igrf, lat: number, lng: number): number {
  const g10 = model.g[1][0], g11 = model.g[1][1], h11 = model.h[1][1];
  const b0 = Math.hypot(g10, g11, h11);
  const axis: Vec = [-g11 / b0, -h11 / b0, -g10 / b0];
  const above = (v: Vec) => v[0] * axis[0] + v[1] * axis[1] + v[2] * axis[2];
  let p = ground(lat, lng);
  const side = Math.sign(above(p)) || 1;
  // The field points down in the north, so the line climbs against it there.
  const sense = side > 0 ? -1 : 1;
  const dir = (v: Vec): Vec => {
    const b = igrfField(model, v);
    const n = Math.hypot(...b);
    return [(sense * b[0]) / n, (sense * b[1]) / n, (sense * b[2]) / n];
  };
  const add = (v: Vec, d: Vec, s: number): Vec => [v[0] + d[0] * s, v[1] + d[1] * s, v[2] + d[2] * s];
  for (let i = 0; i < 5000; i++) {
    const r = Math.hypot(...p);
    if (r > MAX_RADII) return side * 90;
    const ds = 0.02 * r;
    const k1 = dir(p), k2 = dir(add(p, k1, ds / 2)), k3 = dir(add(p, k2, ds / 2)), k4 = dir(add(p, k3, ds));
    const next: Vec = [0, 1, 2].map(j => p[j] + (ds / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j])) as Vec;
    const a = above(p), b = above(next);
    if (Math.sign(b) !== Math.sign(a)) {
      const t = a / (a - b);
      const L = Math.hypot(...add(p, [next[0] - p[0], next[1] - p[1], next[2] - p[2]], t));
      return L <= 1 ? 0 : (side * Math.acos(Math.sqrt(1 / L))) / RAD;
    }
    // Near the magnetic equator the line comes back down before reaching the plane.
    if (Math.hypot(...next) < 1) return 0;
    p = next;
  }
  return Number.NaN;
}
