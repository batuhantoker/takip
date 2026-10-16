/**
 * TAKIP — where the planets and the Moon were on any date, for replaying a
 * spacecraft's flight. The live view takes Horizons states for a day around
 * now; a replay goes back decades, so the planets come from JPL's mean orbital
 * elements instead (Standish, "Approximate Positions of the Planets", table 1,
 * fitted for 1800–2050: arcseconds for the inner planets, a few arcminutes for
 * Jupiter and Saturn), and the Moon from the Astronomical Almanac's
 * low-precision series (about 0.3°). Near a flyby the replay switches to the
 * body's exact Horizons track.
 */

import { AU_KM, add, scale } from '../astro';
import type { Vec3 } from '../horizons';
import type { SkyKey } from '../sky';

const DEG = Math.PI / 180;

type Elements = [a: number, e: number, i: number, L: number, peri: number, node: number];

/** J2000 elements and their rates per Julian century: a (AU), e, I, L, ϖ, Ω (degrees). */
const TABLE: Record<'mercury' | 'venus' | 'emb' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto', [Elements, Elements]> = {
  mercury: [[0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593], [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
  venus: [[0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255], [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418]],
  emb: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0], [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0]],
  mars: [[1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891], [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
  jupiter: [[5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
  saturn: [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
  uranus: [[19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763, 74.01692503], [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589]],
  neptune: [[30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574], [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664]],
  pluto: [[39.48211675, 0.2488273, 17.14001206, 238.92903833, 224.06891629, 110.30393684], [-0.00031596, 0.0000517, 0.00004818, 145.20780515, -0.04062942, -0.01183482]],
};

const centuries = (jd: number) => (jd - 2451545) / 36525;

function fromTable(key: keyof typeof TABLE, jd: number): Vec3 {
  const T = centuries(jd);
  const [base, rate] = TABLE[key];
  const [a, e, i, L, peri, node] = base.map((x, k) => x + rate[k] * T);
  const w = (peri - node) * DEG, O = node * DEG, I = i * DEG;
  const M = ((((L - peri) % 360) + 540) % 360 - 180) * DEG;
  let E = M + e * Math.sin(M);
  for (let k = 0; k < 20; k++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  const x = a * (Math.cos(E) - e), y = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const [cw, sw, cO, sO, cI, sI] = [Math.cos(w), Math.sin(w), Math.cos(O), Math.sin(O), Math.cos(I), Math.sin(I)];
  return [
    ((cw * cO - sw * sO * cI) * x + (-sw * cO - cw * sO * cI) * y) * AU_KM,
    ((cw * sO + sw * cO * cI) * x + (-sw * sO + cw * cO * cI) * y) * AU_KM,
    (sw * sI * x + cw * sI * y) * AU_KM,
  ];
}

const sinD = (d: number) => Math.sin(d * DEG), cosD = (d: number) => Math.cos(d * DEG);
/** General precession in ecliptic longitude, degrees per century: the series is of date, the scene J2000. */
const PRECESSION = 1.3969713;

/** The Moon from Earth's centre, ecliptic J2000, km. */
export function moonGeocentric(jd: number): Vec3 {
  const T = centuries(jd);
  const lon = 218.32 + 481267.881 * T + 6.29 * sinD(135 + 477198.87 * T) - 1.27 * sinD(259.3 - 413335.36 * T)
    + 0.66 * sinD(235.7 + 890534.22 * T) + 0.21 * sinD(269.9 + 954397.74 * T) - 0.19 * sinD(357.5 + 35999.05 * T) - 0.11 * sinD(186.5 + 966404.03 * T)
    - PRECESSION * T;
  const lat = 5.13 * sinD(93.3 + 483202.02 * T) + 0.28 * sinD(228.2 + 960400.89 * T) - 0.28 * sinD(318.3 + 6003.15 * T) - 0.17 * sinD(217.6 - 407332.21 * T);
  const par = 0.9508 + 0.0518 * cosD(135 + 477198.87 * T) + 0.0095 * cosD(259.3 - 413335.36 * T) + 0.0078 * cosD(235.7 + 890534.22 * T) + 0.0028 * cosD(269.9 + 954397.74 * T);
  const r = 6378.14 / sinD(par);
  return [r * cosD(lat) * cosD(lon), r * cosD(lat) * sinD(lon), r * sinD(lat)];
}

/** Earth's share of the Earth–Moon barycentre's offset: the Moon's mass over the pair's. */
const MOON_MASS_FRACTION = 1 / 82.30057;

/** Heliocentric ecliptic-J2000 position, km, for a replay date. */
export function approxPosition(key: SkyKey, jd: number): Vec3 {
  if (key === 'sun') return [0, 0, 0];
  if (key === 'earth' || key === 'moon') {
    const emb = fromTable('emb', jd), moon = moonGeocentric(jd);
    const earth = add(emb, scale(moon, -MOON_MASS_FRACTION));
    return key === 'earth' ? earth : add(earth, moon);
  }
  return fromTable(key, jd);
}
