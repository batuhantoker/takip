import type { TransitMode } from './modes';
import type { Bbox } from './view';

export type TransitFeedKind = 'gtfs-rt' | 'iett' | 'lametro' | 'cta' | 'tfl' | 'hafas' | 'fgc' | 'scheduled';

export interface TransitFeed {
  id: string;
  name: string;
  kind: TransitFeedKind;
  url: string;
  /** Where its vehicles run, padded: from a probe of the live feed, or the static GTFS's stops. */
  bbox: Bbox;
  /** Vehicles in the feed when it was probed; ranks feeds when more meet the view than are fetched. */
  size?: number;
  license?: string;
  /** The static GTFS zip behind it, for a tracked vehicle's route shape. */
  static?: string;
  /** What its routes.txt runs. */
  modes?: TransitMode[];
  /** Its stop graph (generated/stop-graphs) when it gives vehicles by stop, not position. */
  graph?: string;
}

const area = ([w, s, e, n]: Bbox) => Math.max(0, e - w) * Math.max(0, n - s);

function overlap(a: Bbox, b: Bbox): number {
  return area([Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])]);
}

/** A feed that was empty when probed (night there) still counts for a few vehicles. */
const MIN_SIZE = 10;

/**
 * The feeds whose area meets the view, at most `limit`, by how many of their vehicles
 * should be in it: a city's own feed before a shuttle in the corner or a national feed that clips it.
 * Feeds on one stop graph count once: NYC's subway comes as eight feeds, one per group of lines.
 */
export function feedsInView(feeds: readonly TransitFeed[], view: Bbox, limit: number): { picked: TransitFeed[]; skipped: number } {
  const groups = new Map<string, { feeds: TransitFeed[]; expected: number }>();
  for (const f of feeds) {
    const o = overlap(f.bbox, view);
    if (!o) continue;
    const key = f.graph ? `graph:${f.graph}` : f.id;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { feeds: [], expected: 0 }));
    g.feeds.push(f);
    g.expected += (Math.max(f.size ?? 0, MIN_SIZE) * o) / area(f.bbox);
  }
  const ranked = [...groups.values()].sort((x, y) => y.expected - x.expected);
  return { picked: ranked.slice(0, limit).flatMap(g => g.feeds), skipped: Math.max(0, ranked.length - limit) };
}

export const inBbox = (lng: number, lat: number, [w, s, e, n]: Bbox) => lng >= w && lng <= e && lat >= s && lat <= n;

const ROAD_MODES = new Set<TransitMode>(['bus', 'trolleybus']);

/** Every route on the road: a road route between fixes is a fair guess where there is no shape. */
export const isRoadFeed = (f: Pick<TransitFeed, 'modes'>) => !!f.modes?.length && f.modes.every(m => ROAD_MODES.has(m));
