/**
 * TAKIP — how a replay is paced and framed: how fast playback may run at each
 * moment, and how far back a following camera stands.
 */

import { norm, sub } from './astro';
import { LANDED_HOLD_DAYS } from './replay-landing';
import { RADIUS_KM, type ReplayModel } from './replay-model';
import type { SkyKey } from './sky';

/** An encounter's tightest stretch plays over at least this many seconds. */
const STRETCH_SECONDS = 12;
/** Into touchdown playback slows with the time left, down to this many days a second. */
const TOUCHDOWN_SECONDS = 2;
const TOUCHDOWN_FLOOR = 30 / 86_400;
/** The sol on the ground plays over this many seconds. */
const HOLD_SECONDS = 8;
const SCALE_BODIES: SkyKey[] = ['mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

/**
 * How far a following camera should stand back: in cruise a fraction of the
 * craft's distance from the Sun, closing in as it nears any body, so a flyby
 * fills the view and the long coast between them does not.
 */
export function viewScale(m: ReplayModel, jd: number): number {
  const c = m.craftAt(jd);
  let scale = 0.5 * norm(c);
  for (const key of SCALE_BODIES) scale = Math.min(scale, 15 * norm(sub(c, m.bodyAt(key, jd))));
  const l = m.landing;
  // Coming in to land the view closes on the ground, a few radii up at touchdown.
  if (l && m.clamp(jd) >= l.from) {
    const r = RADIUS_KM[l.body];
    return Math.min(scale, 15 * Math.max(0, norm(sub(c, m.bodyAt(l.body, jd))) - r) + 4 * r);
  }
  return Math.max(scale, 3e4);
}

/** The fastest playback may run at `jd`, days a second: slowed through encounters, into touchdown and over the sol after. */
export function rateCap(m: ReplayModel, jd: number): number | null {
  const caps: number[] = [];
  const stretch = m.stretchAt(jd);
  if (stretch !== null) caps.push(stretch / STRETCH_SECONDS);
  const l = m.landing;
  if (l && jd >= l.from) caps.push(jd < l.jd ? Math.max(TOUCHDOWN_FLOOR, (l.jd - jd) / TOUCHDOWN_SECONDS) : LANDED_HOLD_DAYS / HOLD_SECONDS);
  return caps.length ? Math.min(...caps) : null;
}
