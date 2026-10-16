import { PCT_JAM, PCT_SLOW, type TrafficLevel } from '../types';

/**
 * TomTom Traffic Flow vector tiles (Maps API v4, `relative` style): every road TomTom measures,
 * worldwide, as lines with `traffic_level` = current speed / free-flow speed (0–1).
 * Keyed (TOMTOM_API_KEY); the free tier is 200,000 flow tiles a month.
 * https://docs.tomtom.com/traffic-api/documentation/tomtom-maps/traffic-flow/vector-flow-tiles
 */

export const FLOW_SOURCE_LAYER = 'Traffic flow';

/** Deeper views overzoom these tiles, which keeps a city to a dozen requests. */
export const FLOW_MAX_ZOOM = 15;

const TAGS = ['traffic_level', 'traffic_road_coverage', 'left_hand_traffic', 'road_closure', 'road_type'];

export function tomtomFlowUrl(z: number, x: number, y: number, key: string): string {
  return `https://api.tomtom.com/traffic/map/4/tile/flow/relative/${z}/${x}/${y}.pbf?key=${encodeURIComponent(key)}&tags=[${TAGS.join(',')}]`;
}

export const isTileAddress = (z: number, x: number, y: number) =>
  Number.isInteger(z) && Number.isInteger(x) && Number.isInteger(y) && z >= 0 && z <= FLOW_MAX_ZOOM && x >= 0 && y >= 0 && x < 2 ** z && y < 2 ** z;

/** The same cut-offs as NDW's percentage of usual, against TomTom's free-flow speed. */
export const FLOW_SLOW = PCT_SLOW / 100;
export const FLOW_JAM = PCT_JAM / 100;

export function flowLevel(p: Record<string, unknown>): TrafficLevel | null {
  if (p.road_closure === true) return 'jam';
  const level = Number(p.traffic_level);
  if (!Number.isFinite(level)) return null;
  return level < FLOW_JAM ? 'jam' : level < FLOW_SLOW ? 'slow' : null;
}
