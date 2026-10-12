/**
 * TAKIP — the Sun, the Moon and the planets, as the space views use them.
 *
 * The server sends each body's hourly heliocentric states for a day ahead, which
 * the space view interpolates, and its geocentric RA/Dec track, from which the
 * point it stands over on Earth is worked out in the browser as Earth turns.
 */

import { subPoint, wrap180, wrap360 } from './astro';
import type { StateRow, Vec3 } from './horizons';

export type SkyKey = 'sun' | 'mercury' | 'venus' | 'earth' | 'moon' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto';

export interface SkyBodyDef {
  key: SkyKey;
  /** Horizons ID. */
  id: number;
  name: string;
  kind: 'star' | 'planet' | 'moon' | 'dwarf';
  color: string;
  radiusKm: number;
}

export const SKY_BODIES: SkyBodyDef[] = [
  { key: 'sun', id: 10, name: 'Sun', kind: 'star', color: '#FFC24A', radiusKm: 695_700 },
  { key: 'mercury', id: 199, name: 'Mercury', kind: 'planet', color: '#B9AC9F', radiusKm: 2_439.7 },
  { key: 'venus', id: 299, name: 'Venus', kind: 'planet', color: '#EBD3A2', radiusKm: 6_051.8 },
  { key: 'earth', id: 399, name: 'Earth', kind: 'planet', color: '#4FA3FF', radiusKm: 6_371 },
  { key: 'moon', id: 301, name: 'Moon', kind: 'moon', color: '#DADADA', radiusKm: 1_737.4 },
  { key: 'mars', id: 499, name: 'Mars', kind: 'planet', color: '#E2603A', radiusKm: 3_389.5 },
  { key: 'jupiter', id: 599, name: 'Jupiter', kind: 'planet', color: '#D9B38C', radiusKm: 69_911 },
  { key: 'saturn', id: 699, name: 'Saturn', kind: 'planet', color: '#E6CF8B', radiusKm: 58_232 },
  { key: 'uranus', id: 799, name: 'Uranus', kind: 'planet', color: '#9FD8E0', radiusKm: 25_362 },
  { key: 'neptune', id: 899, name: 'Neptune', kind: 'planet', color: '#6B8CFF', radiusKm: 24_622 },
  { key: 'pluto', id: 999, name: 'Pluto', kind: 'dwarf', color: '#C9B79C', radiusKm: 1_188.3 },
];

export interface SkySample {
  jd: number;
  /** Degrees, of date. */
  ra: number;
  dec: number;
  /** Distance from Earth's centre. */
  km: number;
  /** The Moon only: lit fraction and elongation from the Sun. */
  illum?: number;
  elong?: number;
}

export interface SkyBody {
  key: SkyKey;
  name: string;
  kind: SkyBodyDef['kind'];
  color: string;
  radiusKm: number;
  /** Heliocentric ecliptic-J2000 state at the epoch. */
  helio: Vec3;
  vel: Vec3;
  /** Heliocentric states, hourly from an hour before the epoch to a day after. */
  states: StateRow[];
  /** Geocentric track, hourly; empty for Earth. */
  track: SkySample[];
}

export interface SkyPayload {
  epoch: string;
  bodies: SkyBody[];
}

/** The track sample at `jd`, interpolated; RA is unwrapped across 0°/360°. */
export function sampleAt(track: SkySample[], jd: number): SkySample | null {
  if (!track.length) return null;
  if (jd <= track[0].jd) return track[0];
  const last = track[track.length - 1];
  if (jd >= last.jd) return last;
  const i = track.findIndex(s => s.jd >= jd);
  const a = track[i - 1], b = track[i];
  const t = (jd - a.jd) / (b.jd - a.jd);
  const mix = (x: number, y: number) => x + (y - x) * t;
  return {
    jd,
    ra: wrap360(a.ra + wrap180(b.ra - a.ra) * t),
    dec: mix(a.dec, b.dec),
    km: mix(a.km, b.km),
    illum: a.illum !== undefined && b.illum !== undefined ? mix(a.illum, b.illum) : undefined,
    elong: a.elong !== undefined && b.elong !== undefined ? wrap360(a.elong + wrap180(b.elong - a.elong) * t) : undefined,
  };
}

/** Where on Earth the body is overhead at `jd`. */
export function overhead(body: SkyBody, jd: number): ({ lat: number; lng: number } & SkySample) | null {
  const s = sampleAt(body.track, jd);
  return s ? { ...s, ...subPoint(s.ra, s.dec, jd) } : null;
}
