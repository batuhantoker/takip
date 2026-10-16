/**
 * TAKIP — the outer solar system past Neptune: the dwarf planets and the three
 * interstellar visitors from JPL Horizons, and every distant minor planet the
 * Minor Planet Center has an orbit for, placed from its elements.
 */

import { AU_KM } from '../astro';
import type { StateRow, Vec3 } from '../horizons';

export interface OuterBodyDef {
  key: string;
  name: string;
  /** Horizons COMMAND for a small body. */
  command: string;
  radiusKm: number;
  color: string;
}

export const DWARF_PLANETS: OuterBodyDef[] = [
  { key: 'eris', name: 'Eris', command: '136199;', radiusKm: 1_163, color: '#D8D2C8' },
  { key: 'haumea', name: 'Haumea', command: '136108;', radiusKm: 780, color: '#E4E4EC' },
  { key: 'makemake', name: 'Makemake', command: '136472;', radiusKm: 715, color: '#D9A98A' },
  { key: 'gonggong', name: 'Gonggong', command: '225088;', radiusKm: 615, color: '#C98A72' },
  { key: 'quaoar', name: 'Quaoar', command: '50000;', radiusKm: 545, color: '#B98E7A' },
  { key: 'sedna', name: 'Sedna', command: '90377;', radiusKm: 500, color: '#C8604A' },
  { key: 'orcus', name: 'Orcus', command: '90482;', radiusKm: 455, color: '#B8BCC4' },
];

export interface VisitorDef extends OuterBodyDef {
  designation: string;
  perihelion: string;
  note: string;
}

export const VISITORS: VisitorDef[] = [
  { key: 'oumuamua', name: 'ʻOumuamua', designation: '1I/2017 U1', command: 'DES=A/2017 U1;', radiusKm: 0.1, color: '#FF7AD9', perihelion: '2017-09-09', note: 'The first object seen passing through the solar system from interstellar space, found by Pan-STARRS on 2017-10-19 already on its way out.' },
  { key: 'borisov', name: '2I/Borisov', designation: '2I/2019 Q4', command: 'DES=C/2019 Q4;CAP;NOFRAG;', radiusKm: 0.5, color: '#FF7AD9', perihelion: '2019-12-08', note: 'The first interstellar comet, found by Gennadiy Borisov on 2019-08-30.' },
  { key: 'atlas', name: '3I/ATLAS', designation: '3I/2025 N1', command: 'DES=C/2025 N1;CAP;NOFRAG;', radiusKm: 2, color: '#FF7AD9', perihelion: '2025-10-29', note: 'The third known interstellar object, a comet found by ATLAS on 2025-07-01.' },
];

export interface OuterBody {
  key: string;
  name: string;
  kind: 'dwarf' | 'visitor';
  color: string;
  radiusKm: number;
  /** Heliocentric ecliptic-J2000 state at the epoch, km and km/s. */
  helio: Vec3;
  vel: Vec3;
  /** Visitors only: the real hyperbolic path, heliocentric km, oldest first. */
  path?: StateRow[];
}

/** Distant minor planets: [x, y, z] in AU at the epoch, then H and the semi-major axis in AU. */
export type DistantRow = [number, number, number, number, number];

export interface OuterPayload {
  epoch: string;
  bodies: OuterBody[];
  distant: DistantRow[];
  distantSource: string;
}

export interface Elements {
  /** AU. */
  a: number;
  e: number;
  /** Degrees. */
  i: number;
  node: number;
  peri: number;
  /** Mean anomaly at `epochJd`, degrees. */
  M: number;
  epochJd: number;
}

const DEG = Math.PI / 180;
/** Gaussian gravitational constant: the Sun's mean motion at 1 AU, degrees per day. */
const N_1AU = 0.01720209895 / DEG;

/** Heliocentric ecliptic-J2000 position from osculating elements, km; elliptic orbits only. */
export function positionFromElements(el: Elements, jd: number): Vec3 | null {
  if (!(el.a > 0) || el.e >= 1) return null;
  const n = N_1AU / Math.pow(el.a, 1.5);
  const M = (((el.M + n * (jd - el.epochJd)) % 360) + 360) % 360 * DEG;
  let E = el.e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 30; k++) {
    const dE = (E - el.e * Math.sin(E) - M) / (1 - el.e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  const xp = el.a * (Math.cos(E) - el.e);
  const yp = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
  const [cO, sO, cw, sw, ci, si] = [Math.cos(el.node * DEG), Math.sin(el.node * DEG), Math.cos(el.peri * DEG), Math.sin(el.peri * DEG), Math.cos(el.i * DEG), Math.sin(el.i * DEG)];
  return [
    ((cO * cw - sO * sw * ci) * xp + (-cO * sw - sO * cw * ci) * yp) * AU_KM,
    ((sO * cw + cO * sw * ci) * xp + (-sO * sw + cO * cw * ci) * yp) * AU_KM,
    (sw * si * xp + cw * si * yp) * AU_KM,
  ];
}

const PACKED = '0123456789ABCDEFGHIJKLMNOPQRSTUV';

/** MPC packed epoch ("K2669" = 2026-06-09) to a Julian date at 0h TT. */
export function unpackEpoch(p: string): number | null {
  const century = { I: 1800, J: 1900, K: 2000 }[p[0] as 'I' | 'J' | 'K'];
  const year = century !== undefined ? century + Number(p.slice(1, 3)) : NaN;
  const month = PACKED.indexOf(p[3]), day = PACKED.indexOf(p[4]);
  if (!Number.isFinite(year) || month < 1 || month > 12 || day < 1) return null;
  return Date.UTC(year, month - 1, day) / 86_400_000 + 2440587.5;
}

/** One line of an MPCORB-format file (e.g. the MPC's Distant.txt), by its fixed columns. */
export function parseMpcLine(line: string): { H: number; el: Elements } | null {
  const col = (a: number, b: number) => line.slice(a - 1, b).trim();
  const epochJd = unpackEpoch(col(21, 25));
  const [M, peri, node, i, e, a] = [col(27, 35), col(38, 46), col(49, 57), col(60, 68), col(71, 79), col(93, 103)].map(Number);
  const H = Number(col(9, 13));
  if (epochJd === null || [M, peri, node, i, e, a].some(x => !Number.isFinite(x)) || !(a > 0)) return null;
  return { H: Number.isFinite(H) ? H : 99, el: { a, e, i, node, peri, M, epochJd } };
}

/** Where a distant body sits: centaurs cross the giant planets, the Kuiper belt is 30–50 AU, beyond is the scattered disc. */
export function distantClass(a: number): 'centaur' | 'kuiper' | 'scattered' {
  return a < 30 ? 'centaur' : a <= 50 ? 'kuiper' : 'scattered';
}
