/**
 * TAKIP — the heliosphere as a model: the termination shock and the
 * heliopause, shaped along the interstellar inflow and fitted through the
 * points where the two Voyagers actually crossed them. Only those four
 * crossings are measurements; the rest of each surface is illustration.
 */

import { AU_KM, dot, norm, scale } from './astro';
import { bodyDirection } from './frames';
import type { Vec3 } from './horizons';

/** Where the interstellar wind comes from, ecliptic J2000 (IBEX: λ 255.7°, β 5.1°): the heliosphere's nose. */
export const NOSE: Vec3 = bodyDirection(5.1, 255.7);
const NORTH: Vec3 = [0, 0, 1];

export type ShellKey = 'termination-shock' | 'heliopause';

export interface Crossing {
  craftId: number;
  craft: string;
  shell: ShellKey;
  date: string;
  au: number;
}

export const CROSSINGS: Crossing[] = [
  { craftId: -31, craft: 'Voyager 1', shell: 'termination-shock', date: '2004-12-16', au: 94 },
  { craftId: -31, craft: 'Voyager 1', shell: 'heliopause', date: '2012-08-25', au: 121.6 },
  { craftId: -32, craft: 'Voyager 2', shell: 'termination-shock', date: '2007-08-30', au: 83.7 },
  { craftId: -32, craft: 'Voyager 2', shell: 'heliopause', date: '2018-11-05', au: 119 },
];

/** Both Voyagers have flown straight out since their last flybys (Saturn 1980, Neptune 1989); Horizons, 2026-10-12. */
export const VOYAGER_DIRECTIONS: Record<number, Vec3> = {
  [-31]: bodyDirection(35.16, 256.77),
  [-32]: bodyDirection(-38.51, 290.72),
};

/** Radius along `cosTheta` from the nose, before scaling: a blunt shock, an open tail behind the heliopause. */
const PROFILE: Record<ShellKey, (cosTheta: number) => number> = {
  'termination-shock': c => 1 + 0.35 * (1 - c),
  heliopause: c => Math.sqrt(2 / Math.max(1 + c, 0.12)),
};

/** How far back the drawn heliopause goes before its open tail is cut. */
export const TAIL_COS = Math.cos(150 * Math.PI / 180);

export interface Shell { nose: number; squash: number }

/**
 * Scale and north–south squash that put the surface through both crossings:
 * r(d) = nose · profile(d·NOSE) · (1 + squash · d·NORTH), in AU.
 */
export function fitShell(key: ShellKey, crossings: { dir: Vec3; au: number }[]): Shell {
  const [a, b] = crossings.map(c => ({ ...c, dir: scale(c.dir, 1 / norm(c.dir)) }));
  const pa = PROFILE[key](dot(a.dir, NOSE)), pb = PROFILE[key](dot(b.dir, NOSE));
  const na = dot(a.dir, NORTH), nb = dot(b.dir, NORTH);
  // a.au / (pa (1 + s na)) = b.au / (pb (1 + s nb)), solved for s.
  const ra = a.au / pa, rb = b.au / pb;
  const squash = (ra - rb) / (rb * na - ra * nb);
  return { nose: ra / (1 + squash * na), squash };
}

export function shellRadiusAu(key: ShellKey, shell: Shell, dir: Vec3): number {
  const d = scale(dir, 1 / norm(dir));
  return shell.nose * PROFILE[key](dot(d, NOSE)) * (1 + shell.squash * dot(d, NORTH));
}

/** Both shells, fitted through the crossings along each Voyager's direction. */
export function fitHeliosphere(directions: Record<number, Vec3> = VOYAGER_DIRECTIONS): Record<ShellKey, Shell> {
  const fit = (key: ShellKey) => fitShell(key, CROSSINGS.filter(c => c.shell === key).map(c => ({ dir: directions[c.craftId], au: c.au })));
  return { 'termination-shock': fit('termination-shock'), heliopause: fit('heliopause') };
}

/** Where a Voyager crossed a shell, heliocentric km. */
export function crossingPoint(c: Crossing, dir: Vec3): Vec3 {
  return scale(dir, (c.au * AU_KM) / norm(dir));
}
