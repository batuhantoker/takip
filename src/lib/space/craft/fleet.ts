/**
 * TAKIP — every spacecraft JPL Horizons can place right now.
 *
 * The fleet is not a hand-typed list: it is Horizons' own major-body catalogue
 * (`COMMAND='MB'`), filtered to spacecraft. Craft whose ephemeris has ended
 * drop out on Horizons' "No ephemeris … after" reply, and new missions appear
 * once JPL adds them. Where a craft is — Earth orbit, the Moon, L2, Mars, the
 * heliopause — is worked out from its distance to the bodies, not stored.
 */

import { AU_KM, norm, sub, dot } from '../astro';
import type { MajorBody, Vec3 } from '../horizons';

/** Not spacecraft, or not the vehicle: simulations, debris, spent stages, capsules. */
const NOT_A_VEHICLE = /\((simulation|debris)\)|NEOCP|booster|(^|[\s_])RB\b|\bstage\b|S-IVB|centaur|fragment|\bSRC\b|impactor|propulsion module/i;

export function isCandidate(b: MajorBody): boolean {
  return b.id < 0 && b.name.length > 0 && !NOT_A_VEHICLE.test(b.name);
}

/** Drops Horizons' "(spacecraft)" tag, including the cut-off "(spacec" or "(s" the listing truncates to. */
export function craftName(raw: string): string {
  const name = raw.trim().replace(/\s+spacecraft\)$/i, ')');
  const tail = /\s*\(([a-z]*)\)?$/i.exec(name);
  const tag = tail?.[1].toLowerCase();
  return tail && tag && 'spacecraft'.startsWith(tag) ? name.slice(0, tail.index).trim() : name;
}

export type Region =
  | 'earth-orbit' | 'cislunar' | 'moon' | 'sun-earth-l1' | 'sun-earth-l2'
  | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn'
  | 'interplanetary' | 'outer' | 'interstellar';

export const REGION_LABEL: Record<Region, string> = {
  'earth-orbit': 'Earth orbit',
  cislunar: 'Earth–Moon space',
  moon: 'At the Moon',
  'sun-earth-l1': 'Sun–Earth L1',
  'sun-earth-l2': 'Sun–Earth L2',
  mercury: 'At Mercury',
  venus: 'At Venus',
  mars: 'At Mars',
  jupiter: 'Jupiter system',
  saturn: 'Saturn system',
  interplanetary: 'Interplanetary cruise',
  outer: 'Outer solar system',
  interstellar: 'Interstellar space',
};

/** Heliocentric positions of the bodies a craft can be "at", same epoch. */
export interface Neighbours {
  earth: Vec3;
  moon: Vec3;
  mercury?: Vec3;
  venus?: Vec3;
  mars?: Vec3;
  jupiter?: Vec3;
  saturn?: Vec3;
}

/** Sphere-of-influence radii (km), Laplace's approximation. */
const SOI_KM = { mercury: 112_000, venus: 616_000, mars: 577_000, jupiter: 48_200_000, saturn: 54_800_000 } as const;

export function classify(helio: Vec3, n: Neighbours): Region {
  const fromEarth = sub(helio, n.earth);
  const earthKm = norm(fromEarth);
  if (norm(sub(helio, n.moon)) < 80_000) return 'moon';
  if (earthKm < 60_000) return 'earth-orbit';
  if (earthKm < 500_000) return 'cislunar';
  if (earthKm < 2_500_000) {
    // L1 sits between Earth and the Sun, L2 on the far side.
    return dot(fromEarth, n.earth) < 0 ? 'sun-earth-l1' : 'sun-earth-l2';
  }
  for (const key of Object.keys(SOI_KM) as (keyof typeof SOI_KM)[]) {
    const p = n[key];
    if (p && norm(sub(helio, p)) < SOI_KM[key]) return key;
  }
  const au = norm(helio) / AU_KM;
  if (au > 120) return 'interstellar';
  if (au > 30) return 'outer';
  return 'interplanetary';
}

export type FrameKey = 'sun' | 'earth' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn';

/** The body a region's speeds are measured against and its craft move with. */
export const REGION_FRAME: Record<Region, FrameKey> = {
  'earth-orbit': 'earth', cislunar: 'earth', moon: 'moon', 'sun-earth-l1': 'earth', 'sun-earth-l2': 'earth',
  mercury: 'mercury', venus: 'venus', mars: 'mars', jupiter: 'jupiter', saturn: 'saturn',
  interplanetary: 'sun', outer: 'sun', interstellar: 'sun',
};

/** Craft the Space panel offers a flight replay for; the satellite layer draws the ones in Earth orbit. */
export const replayable = (c: { region: Region }) => c.region !== 'earth-orbit';

/** Regions whose heliocentric trail shows a path of its own rather than its host planet's. */
export const TRAIL_REGIONS = new Set<Region>(['mercury', 'venus', 'jupiter', 'saturn', 'interplanetary', 'outer', 'interstellar']);

/** Display order, nearest first. */
export const REGION_ORDER: Region[] = [
  'earth-orbit', 'cislunar', 'moon', 'sun-earth-l1', 'sun-earth-l2', 'mercury', 'venus', 'mars',
  'interplanetary', 'jupiter', 'saturn', 'outer', 'interstellar',
];

export interface FleetCraft {
  id: number;
  name: string;
  cospar: string | null;
  agency: string | null;
  summary: string | null;
  /** Year the mission ended, where known; the craft is still out there. */
  ended: number | null;
  region: Region;
  /** Heliocentric ecliptic-J2000 state at `epoch`, km and km/s. */
  helio: Vec3;
  vel: Vec3;
  sunKm: number;
  earthKm: number;
  /** One-way light time from Earth, seconds. */
  lightSec: number;
  /** Speed relative to `speedFrame` — the body the craft is at, else the Sun. */
  speedKmS: number;
  speedFrame: string;
  /** State relative to that body, which the craft is carried along with between sweeps. */
  frame: FrameKey;
  rel: Vec3;
  relVel: Vec3;
  /** Heliocentric positions over the past year, oldest first. */
  trail: Vec3[];
}

export interface FleetPayload {
  epoch: string;
  craft: FleetCraft[];
  /** Candidates still being looked up on a cold start; the client polls again. */
  pending: number;
  candidates: number;
}
