/**
 * TAKIP — a spacecraft's whole flight, for replaying it: its Horizons
 * trajectory from launch to the end of its ephemeris, the encounters on the
 * way (each with a fine-grained stretch of the craft and the body it met), and
 * where it settled into orbit. Planets come from planets-approx between
 * encounters and from their exact Horizons track during them.
 */

import { norm, sub } from './astro';
import type { Vec3 } from './horizons';
import { approxPosition } from './planets-approx';
import type { SkyKey } from './sky';

/** Positions on a regular grid: sample i is at t0 + i·step (Julian days), flattened x, y, z in km. */
export interface Track { t0: number; step: number; pos: number[] }

export type EncounterKind = 'launch' | 'flyby' | 'arrival' | 'landing';

/** A track with velocities (km/s), flattened like the positions. */
export interface StateTrack extends Track { vel: number[] }

export interface Encounter {
  kind: EncounterKind;
  body: SkyKey;
  /** Closest approach (for an arrival, when it entered its orbit's neighbourhood). */
  jd: number;
  km: number;
  /** Fine stretches, widest first: the craft's and the body's exact tracks over each. */
  craft: Track[];
  bodyTrack: Track[];
}

/**
 * A long stay near one body (in orbit, on its surface, or station-keeping at a
 * Lagrange point): the body's exact track, and the craft's state relative to it
 * on the same grid, from which it is moved along its orbit or kept on the ground.
 */
export interface Phase {
  body: SkyKey;
  t0: number;
  t1: number;
  bodyTrack: Track | null;
  rel: StateTrack | null;
  /** On the body's surface (a lander or rover), rather than orbiting it. */
  landed: boolean;
  /** Typical orbital period, days; null when unbound or landed. */
  periodDays: number | null;
}

export interface HistoryEvent { jd: number; label: string; kind: 'launch' | 'flyby' | 'arrival' | 'landing' | 'crossing' | 'end' | 'now' }

/** Where and when the craft left the ground; the climb to Horizons' first point is drawn, not measured. */
export interface LaunchSite { jd: number; lat: number; lng: number; pad: string; vehicle: string }

export interface CraftHistory {
  id: number;
  name: string;
  launch?: LaunchSite;
  /** Ephemeris span, Julian days. Past `fetchedJd` the track is JPL's prediction. */
  start: number;
  end: number;
  fetchedJd: number;
  coarse: Track;
  encounters: Encounter[];
  phases: Phase[];
  events: HistoryEvent[];
}

export function trackSpan(t: Track): [number, number] {
  return [t.t0, t.t0 + (t.pos.length / 3 - 1) * t.step];
}

/** Linear position on a track; null outside it. */
export function trackAt(t: Track, jd: number): Vec3 | null {
  const n = t.pos.length / 3;
  // A track's last moment is t0 + (n − 1)·step in floating point; a hair either side is still on it.
  const x = Math.min(n - 1, Math.max(0, (jd - t.t0) / t.step));
  if (n === 0 || jd < t.t0 - 1e-6 || jd > t.t0 + (n - 1) * t.step + 1e-6) return null;
  const i = Math.min(n - 2, Math.floor(x)), f = x - i;
  if (n === 1) return [t.pos[0], t.pos[1], t.pos[2]];
  const a = i * 3, b = a + 3;
  return [t.pos[a] + (t.pos[b] - t.pos[a]) * f, t.pos[a + 1] + (t.pos[b + 1] - t.pos[a + 1]) * f, t.pos[a + 2] + (t.pos[b + 2] - t.pos[a + 2]) * f];
}

export function trackSample(t: Track, i: number): Vec3 {
  return [t.pos[i * 3], t.pos[i * 3 + 1], t.pos[i * 3 + 2]];
}

/** Within this of a body the craft is near it: a few spheres of influence, wide enough for a coarse grid to catch. */
export const NEAR_KM: Partial<Record<SkyKey, number>> = {
  mercury: 1.2e6, venus: 3e6, earth: 4e6, moon: 6e5, mars: 3e6,
  jupiter: 5e7, saturn: 5.5e7, uranus: 5e7, neptune: 8e7, pluto: 3e6,
};

/** Leaving Earth crosses the Moon's orbit; only a pass this close is a lunar flyby. */
const FLYBY_KM: Partial<Record<SkyKey, number>> = { moon: 1.5e5 };

/** GM, km³/s²: a craft bound to a body is staying with it, not passing. */
export const GM: Partial<Record<SkyKey, number>> = {
  mercury: 22_032, venus: 324_859, earth: 398_600, moon: 4_903, mars: 42_828,
  jupiter: 126_686_534, saturn: 37_931_187, uranus: 5_793_939, neptune: 6_836_529, pluto: 869,
};
const MAX_FLYBYS = 12;

/** Stretches are fetched in two widths: the whole approach, and a tight one through closest approach. */
export interface Candidate { kind: EncounterKind; body: SkyKey; jd: number; km: number; spans: [number, number][] }
export interface Plan { encounters: Candidate[]; phases: { body: SkyKey; t0: number; t1: number }[] }

/**
 * Where the coarse track comes close to a body, judged against the approximate
 * planets: closest approaches between samples come from linear relative motion,
 * so a fast flyby that falls between two samples is still caught.
 */
export function planEncounters(coarse: Track, position: (key: SkyKey, jd: number) => Vec3 = approxPosition): Plan {
  const n = coarse.pos.length / 3;
  const dt = coarse.step * 86_400;
  const encounters: Candidate[] = [];
  const phases: Plan['phases'] = [];
  for (const body of Object.keys(NEAR_KM) as SkyKey[]) {
    const near = NEAR_KM[body]!, gm = GM[body]!;
    const rel: Vec3[] = [];
    for (let i = 0; i < n; i++) rel.push(sub(trackSample(coarse, i), position(body, coarse.t0 + i * coarse.step)));
    let runStart = -1, bound = 0, samples = 0, best = { d: Infinity, jd: 0, speed: 0 };
    const close = (i: number) => {
      const t0 = coarse.t0 + runStart * coarse.step, t1 = coarse.t0 + i * coarse.step;
      const staying = bound > samples / 2 && t1 - t0 > 3 * coarse.step;
      if (staying) phases.push({ body, t0, t1 });
      if (runStart === 0) encounters.push(stretch('launch', body, coarse.t0, best.d, near, best.speed));
      else if (staying) encounters.push(stretch('arrival', body, t0, best.d, near, best.speed));
      else if (best.d < (FLYBY_KM[body] ?? near)) encounters.push(stretch('flyby', body, best.jd, best.d, near, best.speed));
      runStart = -1;
      bound = samples = 0;
      best = { d: Infinity, jd: 0, speed: 0 };
    };
    for (let i = 0; i < n - 1; i++) {
      const a = rel[i], b = rel[i + 1];
      const d = sub(b, a);
      const s = Math.max(0, Math.min(1, -(a[0] * d[0] + a[1] * d[1] + a[2] * d[2]) / Math.max(1e-9, d[0] * d[0] + d[1] * d[1] + d[2] * d[2])));
      const min = norm([a[0] + d[0] * s, a[1] + d[1] * s, a[2] + d[2] * s]);
      if (min < near) {
        if (runStart < 0) runStart = i;
        const speed = norm(d) / dt;
        samples++;
        if (speed * speed / 2 < gm / Math.max(norm(a), 1)) bound++;
        if (min < best.d) best = { d: min, jd: coarse.t0 + (i + s) * coarse.step, speed };
      } else if (runStart >= 0) close(i);
    }
    if (runStart >= 0) close(n - 1);
  }
  const launches = encounters.filter(e => e.kind === 'launch');
  const rest = encounters.filter(e => e.kind !== 'launch').sort((a, b) => a.km / NEAR_KM[a.body]! - b.km / NEAR_KM[b.body]!).slice(0, MAX_FLYBYS);
  return { encounters: [...launches, ...rest].sort((a, b) => a.jd - b.jd), phases };
}

/**
 * The approach at that speed, capped at 25 days a side, then a stretch a
 * twelfth as long through closest approach, and for a skimming pass (Voyager 2
 * at Neptune, 30,000 km) one finer still.
 */
function stretch(kind: EncounterKind, body: SkyKey, jd: number, km: number, near: number, speedKmS: number): Candidate {
  const half = Math.min(25, Math.max(kind === 'launch' ? 2 : 0.5, (near / Math.max(speedKmS, 0.5)) / 86_400));
  if (kind === 'launch') return { kind, body, jd, km, spans: [[jd, jd + half * 2], [jd, jd + Math.max(0.1, half / 6)]] };
  const tight = Math.max(0.1, half / 12);
  const spans: [number, number][] = [[jd - half, jd + half], [jd - tight, jd + tight]];
  if (km < 150_000 && tight > 0.2) spans.push([jd - tight / 8, jd + tight / 8]);
  return { kind, body, jd, km, spans };
}

/** Close passes during a long stay, which get no stretch of their own: Artemis I's lunar flybys. */
export function passesWithin(phase: { body: SkyKey; t0: number; t1: number }, coarse: Track, bodyTrack: Track): { jd: number; km: number }[] {
  const limit = FLYBY_KM[phase.body] ?? NEAR_KM[phase.body]! / 10;
  const d: { jd: number; km: number }[] = [];
  for (let i = 0; i < coarse.pos.length / 3; i++) {
    const jd = coarse.t0 + i * coarse.step;
    if (jd < phase.t0 || jd > phase.t1) continue;
    const b = trackAt(bodyTrack, jd);
    if (b) d.push({ jd, km: norm(sub(trackSample(coarse, i), b)) });
  }
  return d.filter((x, i) => x.km < limit && (i === 0 || d[i - 1].km > x.km) && (i === d.length - 1 || d[i + 1].km >= x.km));
}

/** 0 at a stretch's edges, 1 in its middle: how much of the exact track to use, so bodies glide onto it. */
export function blendIn(t0: number, t1: number, jd: number, edge = 0.2): number {
  if (jd <= t0 || jd >= t1) return 0;
  const r = (t1 - t0) * edge;
  const k = Math.min(1, (jd - t0) / r, (t1 - jd) / r);
  return k * k * (3 - 2 * k);
}
