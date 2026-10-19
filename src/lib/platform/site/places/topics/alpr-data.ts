import type { PlaceKind } from '../place';

/**
 * data/site/topics/alpr.json: the licence-plate readers mapped on OpenStreetMap in and around each place, as
 * tools/site/topics/alpr.ts counted them from the `alpr` layer in data/db (DeFlock's region files, imported by
 * `npm run import -- deflock-alpr`). US cities and towns count what lies inside their Census limits, as counties and
 * states do; elsewhere a reader is credited to one city only, so a suburb's page doesn't repeat its city's.
 */

export const ALPR_SOURCE = {
  name: 'DeFlock',
  url: 'https://deflock.me',
  data: 'OpenStreetMap contributors',
  license: 'ODbL',
  licenseUrl: 'https://www.openstreetmap.org/copyright',
} as const;

export const FLOCK = 'Flock Safety';

/** Readers a place needs for its page to be indexed. */
export const ALPR_INDEX: Record<PlaceKind, number> = { city: 10, town: 5, county: 5, state: 1, country: 1 };

/** A reader the page lists. */
export interface AlprPick {
  /** OpenStreetMap node id. */
  id: number;
  at: [number, number];
  maker?: string;
  op?: string;
  /** Mapped bearings, degrees from north. */
  dirs?: number[];
}

/** One place's row. */
export interface AlprRow {
  /** Counted inside the Census boundary: a city's or town's limits, or a CDP's for an unincorporated city. */
  bound?: 'limits' | 'cdp';
  /** Otherwise, a city's: how far from the centre a reader can be credited to it, km. */
  r?: number;
  n: number;
  /** Made by Flock Safety. */
  flock: number;
  /** With the direction they face mapped. */
  dir: number;
  /** [maker, readers], most first; makers with one reader are left out. */
  makers: [string, number][];
  /** Readers with an operator mapped. */
  opN: number;
  /** [operator, readers], most first; operators with one reader are left out. */
  ops: [string, number][];
  /** Among places of its kind in its country (a county, in the US), by readers; 1 has the most. */
  rank: number;
  /** Of how many places of its kind with a reader. */
  of: number;
  /** The places inside it, [place id, readers], most first: a country's states, a state's counties, a county's cities. */
  areas?: [number, number][];
  /** A city's nearest its centre; elsewhere the latest added to OpenStreetMap. Indexed pages only. */
  picks?: AlprPick[];
}

export interface AlprMeta {
  /** When DeFlock last rebuilt its region files from OpenStreetMap, ISO. */
  asOf: string;
}

/**
 * A reader goes to the place it is nearest relative to that place's reach: 4 km for a town, up to 25 km for a
 * metropolis such as Houston, so a city keeps its own streets without swallowing the suburbs' readers.
 */
export const alprKm = (pop: number) => Math.round(Math.min(25, Math.max(4, 8 * (pop / 100_000) ** 0.4)));
