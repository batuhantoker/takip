import { EARTH_RADIUS } from './tiles';

/* ── Hanging it in the sky ─────────────────────────────────────────────────── */

/**
 * Display altitude, in metres, for a cloud-top height from 0 (low cloud) to 1
 * (the coldest storm tops), before `cloudLift` scales it for the zoom.
 *
 * The deck sits well clear of the ground so that a tilted view shows air under
 * it: with its base near the surface it read as snow lying on hills. The
 * towers above it keep to about real storm height; taller, a tower drawn on a
 * mesh ten kilometres to the quad stood up as a sharp white sail. A display
 * transform, like the satellites' altitudes, not a measurement.
 */
export const CLOUD_BASE_M = 9_000;
export const CLOUD_RELIEF_M = 15_000;
export function cloudAltitude(height: number): number {
  return CLOUD_BASE_M + Math.min(1, Math.max(0, height)) * CLOUD_RELIEF_M;
}

/**
 * How much the altitudes are stretched at a zoom. Seen from far out, a deck
 * at true height is a film on the globe; it is lifted more the further out the
 * view, up to 2.5 times, and drawn at its own height from zoom 6 in.
 */
export function cloudLift(zoom: number): number {
  return Math.min(2.5, 2 ** (Math.max(0, 6 - zoom) * 0.45));
}

/**
 * How solid the clouds are drawn at a zoom: whole from space, thinning as the
 * view drops toward the ground under them, gone by street level. Zoomed into a
 * town it is the town being looked at, not the weather kilometres above it,
 * and a deck of cloud painted over it hid every place name and road.
 */
const FADE: readonly (readonly [number, number])[] = [[6, 1], [8.5, 0.4], [11, 0]];
export function cloudOpacity(zoom: number): number {
  if (zoom <= FADE[0][0]) return 1;
  if (zoom >= FADE[FADE.length - 1][0]) return 0;
  for (let n = 1; n < FADE.length; n++) {
    const [z0, o0] = FADE[n - 1], [z1, o1] = FADE[n];
    if (zoom <= z1) return o0 + ((o1 - o0) * (zoom - z0)) / (z1 - z0);
  }
  return 0;
}

/** Toward the light: from the north-west and 40° up, with y pointing south as image rows do. */
export const LIGHT = (() => { const v = [-1, -1, 1.2], n = Math.hypot(...v); return v.map(c => c / n); })();
const LIGHT_ELEVATION = Math.asin(LIGHT[2]);

/**
 * How far south-east a cloud's shadow falls from the point under it, in its
 * tile's own units (a tile is 1 across): a mid-height cloud's display altitude
 * over the light's slope, against the tile's width on the ground there.
 */
export function shadowOffset(z: number, latRad: number, lift = 1): number {
  const reach = (cloudAltitude(0.5) * lift) / Math.tan(LIGHT_ELEVATION);
  const tileWidth = (2 * Math.PI * EARTH_RADIUS * Math.cos(latRad)) / 2 ** z;
  return reach / tileWidth;
}
