/**
 * data/site/topics/hiking.json: the waymarked hiking routes around each place, as tools/site/topics/hiking.ts found
 * them through Waymarked Trails. Lengths are kilometres.
 */

export const HIKING_SOURCE = {
  name: 'Waymarked Trails',
  url: 'https://hiking.waymarkedtrails.org/',
  data: 'OpenStreetMap contributors',
  license: 'ODbL',
  licenseUrl: 'https://www.openstreetmap.org/copyright',
} as const;

export type HikingLevel = 'int' | 'nat' | 'reg' | 'loc';

/** Waymarked's network groups by level; the Swiss AL1–AL4 trail grades are signposted local paths. */
export function hikingLevel(group: string): HikingLevel {
  if (group === 'INT') return 'int';
  if (group === 'NAT') return 'nat';
  if (group === 'REG') return 'reg';
  return 'loc';
}

/** A route named on some place's page, keyed by its OpenStreetMap relation id. */
export interface HikingRoute {
  name?: string;
  ref?: string;
  /** Waymarked's group: INT, NAT, REG, LOC, or a grade such as AL2. */
  net: string;
  /** The whole route's mapped length. */
  km?: number;
  /** `km` was measured on Waymarked's simplified lines, not the mapped ways, so it reads a little short. */
  approx?: true;
  /** From the route's own distance tag. */
  officialKm?: number;
  operator?: string;
  /** Where it starts and ends, as mapped. */
  from?: string;
  to?: string;
  /** An OpenStreetMap superroute: a network of this many routes, measured together. */
  stages?: number;
}

export type HikingCounts = Record<HikingLevel, number>;

/** One place's row. */
export interface HikingRow {
  /** The radius searched around the place's centre. */
  r: number;
  /** Routes with a stretch inside the radius, by level. */
  n: HikingCounts;
  /** How many of them have a name or a start and end, not only a number. */
  named: number;
  /** Route-kilometres inside the radius by level; a way two routes share counts for each. */
  kmIn: HikingCounts;
  /** Local routes under 10 km, of those whose whole length is known. */
  shortLocal: number;
  /** Waymarked's listing hit its cap somewhere in the box, so the counts are a floor. */
  capped?: true;
  /** The routes with most length inside the radius: [relation id, km inside], longest first. */
  top: [number, number][];
}

/** What data/site/topics/hiking.json holds beside its rows: every route a row names, once. */
export interface HikingMeta { routes: Record<string, HikingRoute> }

/** How far around a place to look: 15 km for a town, up to 30 km for a metropolis such as Munich. */
export const hikingKm = (pop: number) => Math.round(Math.min(30, Math.max(15, 10 * (pop / 100_000) ** 0.4)));

/** A route has a name when it is called something other than its number, or runs from somewhere to somewhere. */
export function isNamedRoute(r: { name?: string; ref?: string; itinerary?: string[]; from?: string; to?: string }): boolean {
  const name = r.name?.trim();
  if (name && name !== r.ref?.trim() && !/^[\d\s.\-/]+[a-z]?$/i.test(name)) return true;
  return (r.itinerary?.length ?? 0) >= 2 || !!(r.from && r.to);
}

export const routeLink = (id: number) => `https://hiking.waymarkedtrails.org/#route?id=${id}&type=relation`;
