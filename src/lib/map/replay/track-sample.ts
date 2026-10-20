import type { DecodedTrack } from '@takip/core/trk';

/* Where a replayed ship or aircraft is at a moment, from its recorded segments. */

export type ReplayEntity = {
  entity: number;
  cls: 'vessel' | 'aircraft';
  category: string;
  label: string;
  /** This entity's segments in time order; they never overlap. */
  segs: DecodedTrack[];
  color: [number, number, number];
};

/** Bridged gaps are drawn as a straight run between two segments, dimmer than measured track. */
export const BRIDGE_S = 20 * 60;
/** After its last fix an entity stays at it, fading, for this long. */
export const HOLD_S = 15 * 60;

export const bearingRad = (lon1: number, lat1: number, lon2: number, lat2: number) => {
  const r = Math.PI / 180;
  const y = Math.sin((lon2 - lon1) * r) * Math.cos(lat2 * r);
  const x = Math.cos(lat1 * r) * Math.sin(lat2 * r) - Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lon2 - lon1) * r);
  return Math.atan2(y, x);
};

/** Index of the last fix at or before t; -1 before the segment. */
export function fixAt(times: Float64Array, t: number) {
  if (t < times[0]) return -1;
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (times[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** The sample under construction, written by sample() without allocating. Heading in radians, speed in knots, altitude as recorded. */
export const at = { lon: 0, lat: 0, heading: 0, speed: 0, alt: Number.NaN, alpha: 0, held: false };

function headingOf(seg: DecodedTrack, i: number) {
  if (seg.heading) return seg.heading[i] * (Math.PI / 180);
  const j = Math.min(i, seg.n - 2);
  return j >= 0 ? bearingRad(seg.lon[j], seg.lat[j], seg.lon[j + 1], seg.lat[j + 1]) : 0;
}

/** Where an entity is at t, into `at`: inside a segment, across a short gap between two, or held after its last fix. */
export function sample(e: ReplayEntity, t: number): boolean {
  const segs = e.segs;
  let k = -1;
  for (let i = 0; i < segs.length && segs[i].t[0] <= t; i++) k = i;
  if (k < 0) return false;
  const seg = segs[k];
  const last = seg.n - 1;
  const end = seg.t[last];
  at.held = false;
  if (t <= end) {
    const i = fixAt(seg.t, t);
    if (i === last) {
      at.lon = seg.lon[i];
      at.lat = seg.lat[i];
      at.heading = headingOf(seg, i);
      at.speed = seg.speed?.[i] ?? 0;
      at.alt = seg.alt?.[i] ?? Number.NaN;
    } else {
      const f = (t - seg.t[i]) / (seg.t[i + 1] - seg.t[i] || 1);
      at.lon = seg.lon[i] + (seg.lon[i + 1] - seg.lon[i]) * f;
      at.lat = seg.lat[i] + (seg.lat[i + 1] - seg.lat[i]) * f;
      at.heading = seg.heading ? headingOf(seg, f < 0.5 ? i : i + 1) : bearingRad(seg.lon[i], seg.lat[i], seg.lon[i + 1], seg.lat[i + 1]);
      at.speed = seg.speed ? seg.speed[i] + (seg.speed[i + 1] - seg.speed[i]) * f : 0;
      at.alt = seg.alt ? seg.alt[i] + (seg.alt[i + 1] - seg.alt[i]) * f : Number.NaN;
    }
    at.alpha = 1;
    return true;
  }
  const next = segs[k + 1];
  // A short silence between two segments (sparse polling, an hour boundary): bridge it, visibly dimmer.
  if (next && next.t[0] - end <= BRIDGE_S && Math.abs(next.lon[0] - seg.lon[last]) < 180) {
    const f = (t - end) / (next.t[0] - end || 1);
    at.lon = seg.lon[last] + (next.lon[0] - seg.lon[last]) * f;
    at.lat = seg.lat[last] + (next.lat[0] - seg.lat[last]) * f;
    at.heading = bearingRad(seg.lon[last], seg.lat[last], next.lon[0], next.lat[0]);
    at.speed = seg.speed?.[last] ?? 0;
    at.alt = seg.alt && next.alt ? seg.alt[last] + (next.alt[0] - seg.alt[last]) * f : Number.NaN;
    at.alpha = 0.7;
    return true;
  }
  const age = t - end;
  if (age > HOLD_S) return false;
  at.lon = seg.lon[last];
  at.lat = seg.lat[last];
  at.heading = headingOf(seg, last);
  at.speed = seg.speed?.[last] ?? 0;
  at.alt = seg.alt?.[last] ?? Number.NaN;
  at.alpha = 0.8 - 0.55 * (age / HOLD_S);
  at.held = true;
  return true;
}

/** sample() as a value. Heading in degrees; `held` once the entity has gone quiet and sits at its last fix. */
export function sampleEntity(e: ReplayEntity, t: number) {
  if (!sample(e, t)) return null;
  return {
    lon: at.lon, lat: at.lat, heading: (at.heading * 180) / Math.PI, alpha: at.alpha,
    speed: at.speed, alt: Number.isNaN(at.alt) ? null : at.alt, held: at.held,
  };
}
