/**
 * TAKIP — the cosmic web around the galaxies, built by tools/build-cosmic-web.mjs: the voids of SDSS DR7 as
 * their fitted ellipsoids (Douglass et al. 2023, V2/VIDE), the all-sky voids between superclusters (Einasto et
 * al. 1994) and the supervoids among the Gaia Quaia quasars (Arsenov et al. 2025) as spheres, the 25 nearest voids
 * (Pustilnik et al. 2019) as ellipsoids, and the filament spines traced through SDSS DR8 (Tempel et al. 2014); and the
 * gravitational basins of the Cosmicflows-4 velocity field, Laniakea among them (Dupuy & Courtois 2023), as meshes.
 * Millions of light-years, J2000 equatorial, comoving, like lib/space/deep/cosmos.ts.
 */

import { msg } from '@/lib/core/i18n/translator';
import type { Vec3 } from '../horizons';

/**
 * Which catalogue a void is from: Douglass et al. 2023 (SDSS), Einasto et al. 1994 (all sky, near), Arsenov et al.
 * 2025 (Quaia, far), Pustilnik et al. 2019 (the nearest, all sky).
 */
export type VoidCatalogue = 'sdss' | 'network' | 'quaia' | 'local';
const CATALOGUES: VoidCatalogue[] = ['sdss', 'network', 'quaia', 'local'];

export interface CosmicVoid {
  centre: Vec3;
  catalogue: VoidCatalogue;
  /** The ellipsoid's three semi-axes as vectors. */
  axes: [Vec3, Vec3, Vec3];
  /** Radius of the sphere of the same volume. */
  reffMly: number;
  /** A nearby void's place in Pustilnik et al.'s list, NEARBY_VOIDS. */
  nearby?: number;
}

/** A Cosmicflows-4 basin: where every galaxy flows toward one attractor, or away from one repeller. */
export interface Basin {
  id: string;
  kind: 'attraction' | 'repulsion';
  /** Centre of its volume. */
  centre: Vec3;
  /** The attractor or repeller. */
  core: Vec3;
  reffMly: number;
  /** End to end. */
  acrossMly: number;
  volumeHMpc3: number;
}

export interface NearbyVoid { name: string; galaxies: number }

/** Pustilnik et al. name the nearest voids by the constellations they lie behind. */
export const NEARBY_VOID_NAMES: Record<string, string> = {
  'Cas-And': msg('Cassiopeia–Andromeda Void'), Tuc: msg('Tucana Void'), 'Cet-Scu-Psc': msg('Cetus–Sculptor–Pisces Void'), Pho: msg('Phoenix Void'),
  Tau: msg('Taurus Void'), Per: msg('Perseus Void'), 'Eri-Ori': msg('Eridanus–Orion Void'), 'Ori-Tau': msg('Orion–Taurus Void'), Aur: msg('Auriga Void'),
  Lep: msg('Lepus Void'), Mon: msg('Monoceros Void'), 'Cnr-CMi-Hyd': msg('Cancer–Canis Minor–Hydra Void'), Vel: msg('Vela Void'), Hyd: msg('Hydra Void'),
  'Cen-Cir': msg('Centaurus–Circinus Void'), UMa: msg('Ursa Major Void'), 'Vir-Boo': msg('Virgo–Boötes Void'), Boo: msg('Near Boötes Void'),
  Lib: msg('Libra Void'), Her: msg('Hercules Void'), 'Oph-Sgr-Cap': msg('Ophiuchus–Sagittarius–Capricornus Void'), 'Dra-Cep': msg('Draco–Cepheus Void'),
  Cyg: msg('Cygnus Void'), 'Pav-Oct': msg('Pavo–Octans Void'), Aqu: msg('Aquarius Void'),
};

export interface BasinMesh { positions: Float32Array; indices: Uint32Array }

/** Streamlines of the Cosmicflows-4 velocity field, each in the direction matter moves, by basin. */
export interface BasinFlows { basin: Uint16Array; counts: Uint16Array; points: Float32Array }

export interface CosmicWeb {
  voids: CosmicVoid[];
  /** Point count of each filament, in order. */
  filamentPoints: Uint16Array;
  /** Every filament's points, one after another, x y z. */
  points: Float32Array;
}

const len = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);

export function parseCosmicWeb(buf: ArrayBuffer): CosmicWeb {
  const head = new DataView(buf);
  const nv = head.getUint32(0, true), nf = head.getUint32(4, true), np = head.getUint32(8, true);
  const v = new Float32Array(buf, 12, nv * 13);
  let nearby = 0;
  const voids = Array.from({ length: nv }, (_, i): CosmicVoid => {
    const at = (k: number): Vec3 => [v[i * 13 + k], v[i * 13 + k + 1], v[i * 13 + k + 2]];
    const axes: [Vec3, Vec3, Vec3] = [at(3), at(6), at(9)];
    const catalogue = CATALOGUES[v[i * 13 + 12]] ?? 'sdss';
    return { centre: at(0), catalogue, axes, reffMly: Math.cbrt(len(axes[0]) * len(axes[1]) * len(axes[2])), ...(catalogue === 'local' ? { nearby: nearby++ } : {}) };
  });
  const countsAt = 12 + nv * 52;
  const filamentPoints = new Uint16Array(buf.slice(countsAt, countsAt + nf * 2));
  const pointsAt = countsAt + Math.ceil((nf * 2) / 4) * 4;
  return { voids, filamentPoints, points: new Float32Array(buf, pointsAt, np * 3) };
}

/** basins.bin: each basin's surface, in the order of BASINS, and the streamlines through them. */
export function parseBasins(buf: ArrayBuffer): { meshes: BasinMesh[]; flows: BasinFlows } {
  const head = new DataView(buf);
  const n = head.getUint32(0, true);
  let o = 4 + n * 8;
  const meshes = Array.from({ length: n }, (_, i) => {
    const nv = head.getUint32(4 + i * 8, true), nt = head.getUint32(8 + i * 8, true);
    const positions = new Float32Array(buf, o, nv * 3);
    const indices = new Uint32Array(buf, o + nv * 12, nt * 3);
    o += nv * 12 + nt * 12;
    return { positions, indices };
  });
  const lines = head.getUint32(o, true);
  const basin = new Uint16Array(lines), counts = new Uint16Array(lines);
  for (let i = 0; i < lines; i++) { basin[i] = head.getUint16(o + 4 + i * 4, true); counts[i] = head.getUint16(o + 6 + i * 4, true); }
  o += 4 + lines * 4;
  const total = counts.reduce((a, b) => a + b, 0);
  return { meshes, flows: { basin, counts, points: new Float32Array(buf, o, total * 3) } };
}

/** Each filament as line segments between its neighbouring points, for a LineSegments buffer. */
export function filamentSegments(web: CosmicWeb): Float32Array {
  const segs = web.filamentPoints.reduce((n, c) => n + Math.max(0, c - 1), 0);
  const out = new Float32Array(segs * 6);
  let p = 0, o = 0;
  for (const c of web.filamentPoints) {
    for (let k = 0; k < c - 1; k++, o += 6) out.set(web.points.subarray((p + k) * 3, (p + k) * 3 + 6), o);
    p += c;
  }
  return out;
}

/** Boötes Void, the best known, centred near RA 218°, Dec +46° at about 700 million light-years (Kirshner et al. 1981). */
export const BOOTES: Vec3 = (() => {
  const r = Math.PI / 180, ra = 218 * r, dec = 46 * r, d = 700;
  return [d * Math.cos(dec) * Math.cos(ra), d * Math.cos(dec) * Math.sin(ra), d * Math.sin(dec)];
})();

/** The catalogued void holding Boötes' centre, if any: the one whose ellipsoid it falls deepest inside. */
export function bootesIndex(voids: CosmicVoid[]): number {
  let best = -1, depth = Infinity;
  voids.forEach((v, i) => {
    if (v.catalogue !== 'sdss') return;
    const d = len([BOOTES[0] - v.centre[0], BOOTES[1] - v.centre[1], BOOTES[2] - v.centre[2]]) / v.reffMly;
    if (d < 1 && d < depth) { depth = d; best = i; }
  });
  return best;
}
