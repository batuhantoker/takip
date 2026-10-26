/*
 * Which layers the past views can show. Turning on one they can't is a request for today's data, so
 * the map goes back to live (use-back-to-live.ts).
 */

/** Display settings that still make sense in the past. Every data layer is today's, so History turns the rest off. */
export const HISTORY_KEEPS = new Set(['terrain_3d', 'terrain_elevation', 'sky_stars']);

/**
 * Replay moves recorded ships and aircraft, satellites and dated imagery with its clock, and is a few days
 * back at most, so static reference layers still hold. The other layers are live feeds.
 */
const REPLAY_KEEPS = new Set([...HISTORY_KEEPS, 'flights', 'private', 'jets', 'military', 'maritime', 'satellites', 'cables', 'infrastructure', 'hiking_routes', 'things_to_do', 'wx_radar', 'wx_lightning']);
const REPLAY_PREFIXES = ['ships_', 'sat_'];

/** Whether turning `layer` on needs today's map rather than the past one shown. */
export function needsLive(layer: string, past: 'history' | 'replay'): boolean {
  if (past === 'history') return !HISTORY_KEEPS.has(layer);
  return !REPLAY_KEEPS.has(layer) && !REPLAY_PREFIXES.some(p => layer.startsWith(p));
}
