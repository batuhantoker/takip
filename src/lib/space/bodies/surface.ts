/**
 * TAKIP — what moves over the Moon and Mars: orbiters (ground tracks from JPL
 * Horizons) and the two Mars rovers NASA publishes positions for.
 */

import { wrap180 } from '../astro';
import type { GlobeWorldId } from '../worlds';

export interface TrackPoint {
  /** Epoch milliseconds. */
  t: number;
  lat: number;
  /** East longitude, -180..180. */
  lng: number;
  altKm: number;
}

export interface SurfaceOrbiter {
  id: number;
  name: string;
  agency: string | null;
  summary: string | null;
  track: TrackPoint[];
}

export interface SurfaceRover {
  key: string;
  name: string;
  agency: string;
  sol: number | null;
  lat: number;
  lng: number;
  /** Odometry since landing. */
  driveKm: number | null;
  /** [lng, lat] from landing to now, thinned. */
  traverse: [number, number][];
}

/** Where the Sun and Earth stand overhead on the body: its terminator and its Earth-facing side. */
export interface LightingPoint {
  t: number;
  sun: [number, number];
  earth: [number, number];
}

export interface SurfacePayload {
  body: GlobeWorldId;
  epoch: string;
  orbiters: SurfaceOrbiter[];
  rovers: SurfaceRover[];
  lighting: LightingPoint[];
}

/** Lighting at `t`, interpolated hourly samples; longitudes the short way round. */
export function lightingAt(points: LightingPoint[], t: number): LightingPoint | null {
  if (!points.length) return null;
  if (t <= points[0].t) return points[0];
  const i = points.findIndex(p => p.t >= t);
  if (i < 0) return points[points.length - 1];
  const a = points[i - 1], b = points[i];
  const f = (t - a.t) / (b.t - a.t || 1);
  const mix = (p: [number, number], q: [number, number]): [number, number] => [wrap180(p[0] + wrap180(q[0] - p[0]) * f), p[1] + (q[1] - p[1]) * f];
  return { t, sun: mix(a.sun, b.sun), earth: mix(a.earth, b.earth) };
}

/** Position on a track at `t`; null outside it rather than a guess. */
export function trackAt(track: TrackPoint[], t: number): TrackPoint | null {
  if (track.length < 2 || t < track[0].t || t > track[track.length - 1].t) return null;
  const i = Math.max(1, track.findIndex(p => p.t >= t));
  const a = track[i - 1], b = track[i];
  const f = (t - a.t) / (b.t - a.t || 1);
  return {
    t,
    lat: a.lat + (b.lat - a.lat) * f,
    lng: wrap180(a.lng + wrap180(b.lng - a.lng) * f),
    altKm: a.altKm + (b.altKm - a.altKm) * f,
  };
}

/** Splits a lng/lat line where it crosses ±180°, so it is not drawn the long way round. */
export function splitAtAntimeridian(coords: [number, number][]): [number, number][][] {
  const out: [number, number][][] = [];
  let line: [number, number][] = [];
  for (const p of coords) {
    const prev = line[line.length - 1];
    if (prev && Math.abs(p[0] - prev[0]) > 180) {
      if (line.length > 1) out.push(line);
      line = [];
    }
    line.push(p);
  }
  if (line.length > 1) out.push(line);
  return out;
}

/** Keeps every nth point so a line stays under `max`, always ending on the last. */
export function thin<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  const out = points.filter((_, i) => i % step === 0);
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
  return out;
}

/** An observer row's time; the column is "Date__(UT)__HR:MN" or "…:SC.fff" depending on the step. */
export function rowTimeMs(row: Record<string, string>): number {
  const key = Object.keys(row).find(k => k.startsWith('Date__'));
  return key ? horizonsDateMs(row[key]) : NaN;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Horizons' observer-table time, "2026-Oct-12 20:24:00.000" (UT). */
export function horizonsDateMs(s: string): number {
  const m = /^(\d{4})-([A-Za-z]{3})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?/.exec(s.trim());
  if (!m) return NaN;
  const month = MONTHS.indexOf(m[2]);
  if (month < 0) return NaN;
  return Date.UTC(+m[1], month, +m[3], +m[4], +m[5]) + Math.round(Number(m[6] ?? 0) * 1000);
}
