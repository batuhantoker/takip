import { DAY_MS, HOUR_MS } from './time';

/*
 * Track levels of detail and codes (docs/architecture/replay-database.md §8.3).
 * Shared by the seal jobs, the store, the API and the browser layer.
 */

export const TrackClass = { vessel: 1, aircraft: 2 } as const;
export type TrackClass = (typeof TrackClass)[keyof typeof TrackClass];
export type TrackClassName = keyof typeof TrackClass;

export const trackClassByName = (name: string): TrackClass | undefined =>
  Object.prototype.hasOwnProperty.call(TrackClass, name) ? TrackClass[name as TrackClassName] : undefined;

/** Index = the category code stored in trk_segment.category; names match the live layers' filters. */
export const VESSEL_CATEGORIES = ['other', 'cargo', 'tanker', 'passenger', 'fishing', 'military', 'service', 'leisure'] as const;
export const AIRCRAFT_CATEGORIES = ['commercial', 'private', 'jet', 'military'] as const;

export type Lod = 0 | 1 | 2;
export const LOD_LEVELS: readonly Lod[] = [0, 1, 2];

export type LodSpec = {
  bucketMs: number;
  /** One shard file per period. */
  shard: 'day' | 'month' | 'year';
  /** Chunks are fetched as tiles at this zoom, whatever the map zoom. */
  fetchZoom: number;
  /** Map zooms this level is drawn at. */
  minZoom: number;
  maxZoom: number;
  /** Coordinates are stored as round(deg · scale). */
  scale: number;
  /** SED tolerance in metres; 0 keeps every fix. */
  sedM: number;
  /** At most one point per this many seconds (0: no limit). */
  minIntervalS: number;
  /** While moving, at least one point per this many seconds (0: no floor). */
  maxIntervalS: number;
  /** A longer silence splits the segment: the client never interpolates across it. */
  maxGapS: Record<TrackClassName, number>;
  servedDays: number;
};

export const LODS: Record<Lod, LodSpec> = {
  // Aircraft get 4 min rather than the design's 2: OpenSky is polled every 90 s, so one missed poll is 3 min.
  0: { bucketMs: HOUR_MS, shard: 'day', fetchZoom: 7, minZoom: 8, maxZoom: 24, scale: 1e5, sedM: 0, minIntervalS: 0, maxIntervalS: 0, maxGapS: { vessel: 900, aircraft: 240 }, servedDays: 14 },
  1: { bucketMs: 6 * HOUR_MS, shard: 'month', fetchZoom: 4, minZoom: 5, maxZoom: 8, scale: 1e5, sedM: 100, minIntervalS: 30, maxIntervalS: 0, maxGapS: { vessel: 1800, aircraft: 1800 }, servedDays: 90 },
  2: { bucketMs: DAY_MS, shard: 'year', fetchZoom: 1, minZoom: 0, maxZoom: 5, scale: 1e4, sedM: 2000, minIntervalS: 0, maxIntervalS: 600, maxGapS: { vessel: 3600, aircraft: 3600 }, servedDays: Infinity },
};

/**
 * Hour H is final at H+2:05: fixes for H can still arrive in H+1's file (§7.3). A bucket sealed before
 * it is final is provisional, and is sealed again once it is.
 */
export const SEAL_DELAY_MS = 2 * HOUR_MS + 5 * 60_000;

export const isProvisional = (lod: Lod, bucket: number, sealedAt: number) =>
  sealedAt < bucket + LODS[lod].bucketMs - HOUR_MS + SEAL_DELAY_MS;

/** The LOD drawn at a map zoom. */
export const lodForZoom = (zoom: number): Lod => (zoom >= LODS[0].minZoom ? 0 : zoom >= LODS[1].minZoom ? 1 : 2);

/** TRK1 header flags (§8.3). */
export const TrkFlag = {
  hasAlt: 1,
  hasSpeed: 2,
  hasHeading: 4,
  hasGaps: 8,
  /** Coordinates at 1e4 instead of 1e5. */
  coarse: 16,
  /** Times are when we received the fix, not when it was observed (AIS). */
  tIsReceive: 32,
} as const;
