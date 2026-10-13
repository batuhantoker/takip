/**
 * TAKIP — the climb from the pad in a replay. Horizons' tracks start after
 * liftoff, sometimes with the post-launch orbit run back below the ground; the
 * climb to where they begin is drawn, not measured, and the UI says so.
 */

import { add, cross, dot, lerp, norm, scale, sub } from './astro';
import { trackSample, type CraftHistory, type LaunchSite } from './flight-history';
import { bodyDirection, earthOrientation, mul } from './frames';
import type { Vec3 } from './horizons';

const EARTH_KM = 6371;

/**
 * Where Horizons' track has cleared the ground: Spirit's first point is 440 km
 * underground, the orbit after launch run backwards; the climb runs on to there.
 */
export function clearedStart(h: CraftHistory): number {
  const e = h.launch && h.encounters.find(x => x.kind === 'launch' && x.body === 'earth');
  const craft = e?.craft[e.craft.length - 1], body = e?.bodyTrack[e.bodyTrack.length - 1];
  if (!craft || !body) return h.start;
  const n = Math.min(craft.pos.length, body.pos.length) / 3;
  for (let i = 0; i < n; i++) {
    if (norm(sub(trackSample(craft, i), trackSample(body, i))) > EARTH_KM + 150) return i === 0 ? h.start : Math.max(h.start, craft.t0 + i * craft.step);
  }
  return h.start;
}

/**
 * The climb from the pad to Horizons' first point, as an illustration: up off
 * the pad, round the Earth eastward in the plane of the first orbit at a low
 * parking altitude, and out to that point, arriving with its velocity.
 * `first` is that point's state relative to Earth.
 */
export function ascentAt(l: LaunchSite, start: number, t: number, earth: Vec3, first: { r: Vec3; v: Vec3 }): Vec3 {
  const s = (t - l.jd) / (start - l.jd);
  const pad = mul(earthOrientation(t), bodyDirection(l.lat, l.lng));
  const r1 = norm(first.r);
  const n = cross(first.r, first.v);
  const axis = scale(n, 1 / (norm(n) || 1));
  // The sweep is measured from the pad at liftoff: from the turning pad it would wrap past a full turn mid-climb.
  const pad0 = mul(earthOrientation(l.jd), bodyDirection(l.lat, l.lng));
  const inPlane = sub(pad0, scale(axis, dot(pad0, axis)));
  const a = scale(inPlane, 1 / (norm(inPlane) || 1)), b = scale(first.r, 1 / r1);
  let sweep = Math.atan2(dot(cross(a, b), axis), dot(a, b));
  if (sweep < 0) sweep += 2 * Math.PI;
  const turn = sweep * s;
  const along: Vec3 = add(scale(a, Math.cos(turn)), scale(cross(axis, a), Math.sin(turn)));
  const off = Math.min(1, s / 0.1);
  const dir = lerp(pad, along, off * off * (3 - 2 * off));
  const climb = Math.min(1, s / 0.12);
  const alt = 200 * climb * climb * (3 - 2 * climb) + (r1 - EARTH_KM - 200) * s ** 4;
  return add(earth, scale(dir, (EARTH_KM + alt) / (norm(dir) || 1)));
}
