/**
 * TAKIP — a lander's last leg in a replay. Inside the body's Hill sphere the
 * craft is placed relative to the body, from Horizons' own relative samples
 * (craft and body tracks on one grid), so the approach and descent stay glued
 * to the body as drawn; from touchdown it rests on the spot it landed on, in
 * the body's own frame, turning with it.
 */

import { norm, scale, sub } from '../astro';
import { trackAt, trackSample, trackSpan, type CraftHistory, type Track } from './flight-history';
import { mul, transpose, type Mat3 } from '../frames';
import type { Vec3 } from '../horizons';
import type { SkyKey } from '../sky';

/** A dot on a surface sits this far above the sphere, so the sphere's facets do not swallow it. */
export const SURFACE_LIFT_KM = 2;
/** After touchdown the replay holds on the spot for about a sol, then ends. */
export const LANDED_HOLD_DAYS = 1.03;

export interface Landing {
  body: SkyKey;
  /** Touchdown, JD. */
  jd: number;
  /** From here on the craft is placed relative to the body. */
  from: number;
  /** The approach relative to the body, on increasing JD, ending at touchdown. */
  times: Float64Array;
  rel: Float64Array;
  /** Where it came to rest, body-fixed km. */
  fixed: Vec3;
  lat: number;
  lng: number;
}

interface RelTrack { t0: number; t1: number; step: number; at: (jd: number) => Vec3 | null; sample: (i: number) => Vec3 }

/** Craft and body sampled on one grid: their difference is the craft relative to the body. */
function pairTrack(craft: Track, body: Track): RelTrack | null {
  if (Math.abs(craft.t0 - body.t0) > 1e-6 || Math.abs(craft.step - body.step) > 1e-9) return null;
  const n = Math.min(craft.pos.length, body.pos.length) / 3;
  const [t0] = trackSpan(craft);
  return {
    t0, t1: t0 + (n - 1) * craft.step, step: craft.step,
    at: jd => { const c = trackAt(craft, jd), b = trackAt(body, jd); return c && b ? sub(c, b) : null; },
    sample: i => sub(trackSample(craft, i), trackSample(body, i)),
  };
}

/** Lifts a point inside the drawn sphere to just above it. */
export function aboveSurface(rel: Vec3, radiusKm: number): Vec3 {
  const n = norm(rel), floor = radiusKm + SURFACE_LIFT_KM;
  return n >= floor || n === 0 ? rel : scale(rel, floor / n);
}

export function findLanding(h: CraftHistory, hillKm: number, radiusKm: number, orientation: (jd: number) => Mat3 | null): Landing | null {
  const phase = h.phases.find(p => p.landed && p.rel);
  if (!phase?.rel) return null;
  const body = phase.body;
  const stayRel = phase.rel;
  const coarse: RelTrack = {
    t0: stayRel.t0, t1: trackSpan(stayRel)[1], step: stayRel.step,
    at: jd => trackAt(stayRel, jd), sample: i => trackSample(stayRel, i),
  };
  const fine = h.encounters
    .filter(e => e.body === body && (e.kind === 'arrival' || e.kind === 'landing'))
    .flatMap(e => e.craft.map((c, i) => (e.bodyTrack[i] ? pairTrack(c, e.bodyTrack[i]) : null)))
    .filter((t): t is RelTrack => t !== null);
  const tracks = [coarse, ...fine].sort((a, b) => b.step - a.step);
  const finest = (jd: number) => {
    for (let i = tracks.length - 1; i >= 0; i--) if (jd >= tracks[i].t0 - 1e-9 && jd <= tracks[i].t1 + 1e-9) return tracks[i];
    return null;
  };

  // Touchdown: the landing stretch's own moment, else the first stay sample on the ground.
  const landingEncounter = h.encounters.find(e => e.kind === 'landing' && e.body === body);
  let jd = landingEncounter?.jd ?? NaN;
  if (!Number.isFinite(jd)) {
    const n = stayRel.pos.length / 3;
    const i = Array.from({ length: n }, (_, k) => norm(trackSample(stayRel, k))).findIndex(d => d < radiusKm + 100);
    jd = i >= 0 ? stayRel.t0 + i * stayRel.step : phase.t0;
  }
  const atTouchdown = finest(jd)?.at(jd);
  const R = orientation(jd);
  if (!atTouchdown || !R) return null;

  const samples: { jd: number; rel: Vec3 }[] = [];
  for (const t of tracks) {
    const n = Math.round((t.t1 - t.t0) / t.step) + 1;
    for (let i = 0; i < n; i++) {
      const at = t.t0 + i * t.step;
      if (at < jd - 1e-9 && finest(at) === t) samples.push({ jd: at, rel: t.sample(i) });
    }
  }
  samples.sort((a, b) => a.jd - b.jd);
  const fixed = aboveSurface(mul(transpose(R), atTouchdown), radiusKm);
  samples.push({ jd, rel: mul(R, fixed) });
  // The body's frame takes over where the craft last entered its Hill sphere.
  let first = samples.length - 1;
  while (first > 0 && norm(samples[first - 1].rel) < hillKm) first--;
  const kept = samples.slice(first);
  const r = norm(fixed);
  return {
    body, jd, from: kept[0].jd,
    times: Float64Array.from(kept, s => s.jd),
    rel: Float64Array.from(kept.flatMap(s => aboveSurface(s.rel, radiusKm))),
    fixed,
    lat: Math.asin(fixed[2] / r) * 180 / Math.PI,
    lng: Math.atan2(fixed[1], fixed[0]) * 180 / Math.PI,
  };
}

/** The craft relative to the body during the approach; clamped to its ends. */
export function approachAt(l: Landing, jd: number): Vec3 {
  const t = l.times, n = t.length;
  if (jd <= t[0]) return [l.rel[0], l.rel[1], l.rel[2]];
  if (jd >= t[n - 1]) return [l.rel[(n - 1) * 3], l.rel[(n - 1) * 3 + 1], l.rel[(n - 1) * 3 + 2]];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t[mid] <= jd) lo = mid; else hi = mid;
  }
  const f = (jd - t[lo]) / (t[hi] - t[lo]);
  const a = lo * 3, b = hi * 3;
  return [l.rel[a] + (l.rel[b] - l.rel[a]) * f, l.rel[a + 1] + (l.rel[b + 1] - l.rel[a + 1]) * f, l.rel[a + 2] + (l.rel[b + 2] - l.rel[a + 2]) * f];
}
