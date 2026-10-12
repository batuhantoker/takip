import type { Bbox } from '@takip/core/tiles';
import type { Lod, TrackClass } from '@takip/core/tracks';

/*
 * The only callers of SQL (replay-database.md §11.2). Built so far: CatalogStore (sources, identity,
 * shards, coverage, access) and TrackStore. EventStore, SeriesStore, FeatureStore and DocStore
 * arrive with the importers and stream ingest.
 */

export type SourceRow = {
  sourceId: number;
  code: string;
  name: string;
  licenceId: number;
  trackBit: number | null;
  attribution: string | null;
  delivery: 'stream' | 'poll' | 'bulk' | 'manual';
  /** Write the raw archive. */
  record: boolean;
  /** Derive history (tracks, events, …) from the archive. */
  build: boolean;
  switchedAt: number | null;
  switchedBy: string | null;
};

export type IdentityItem = { value: string; first: number; last: number; name?: string | null };

export type CoverageStatus = 'ok' | 'degraded' | 'down' | 'not_recording';
export type CoverageRow = { source: string; tLo: number; tHi: number | null; status: CoverageStatus };

export type SealedBucket = { lod: Lod; bucket: number; segments: number; points: number; buildVersion: number; sealedAt: number };

export type ShardRow = {
  path: string;
  kind: 'tracks' | 'stream' | 'geo' | 'tle';
  lod: number | null;
  tLo: number | null;
  tHi: number | null;
  status: 'open' | 'sealed' | 'cold' | 'superseded';
  rows: number | null;
  bytes: number | null;
};

export type IngestRun = {
  sourceId: number;
  startedAt: number;
  finishedAt: number;
  status: 'ok' | 'partial' | 'failed' | 'short';
  records: number;
  inserted: number;
  /** The archive hour it read, e.g. `celestrak/2026-10-12T13`. */
  archiveRef: string;
  error?: string;
};

export type Tier = 'anon' | 'free' | 'paid' | 'internal';

/** What a licence tier may see: computed once per tier and kept in memory (§8.7). */
export type Policy = { tier: Tier; sourceIds: ReadonlySet<number>; trackMask: number; hash: string };

/** A polity with a map key (scheme `takip`): ADM0_A3 for today's shapes, `hist:*` for historical polities. */
export type PolityKey = { entityId: number; key: string; name: string | null; kind: string };
/** A historical polity drawn on today's shape `renderKey` while [validLo, validHi) holds (§6). */
export type PolityRender = { entityId: number; renderKey: string; validLo: number; validHi: number | null };

export interface CatalogStore {
  sources(): SourceRow[];
  source(code: string): SourceRow | undefined;
  /** Turns recording or history building on or off for one source; returns false for an unknown code. */
  setSourceSwitches(code: string, switches: { record?: boolean; build?: boolean }, by: string): boolean;
  resolve(scheme: string, value: string, at: number): number | undefined;
  /** Resolves every value, creating an entity and identifier for the unseen ones. Never creates overlapping validity. */
  ensureIdentities(type: string, scheme: string, sourceId: number, items: IdentityItem[]): Map<string, number>;
  /** Last known category name per entity, kept in core_entity.attrs so a later hour without static data still knows it. */
  entityCategories(ids: number[]): Map<number, string>;
  setEntityCategories(categories: Map<number, string>): void;
  /** Publication: written after the shard's facts, so a reader never sees a sealed bucket without its rows (§4.2). */
  markSealed(row: SealedBucket, shard: ShardRow, layers: string[]): void;
  sealedBuckets(lod: Lod, from: number, to: number): SealedBucket[];
  sealedBucket(lod: Lod, bucket: number): SealedBucket | undefined;
  /** Buckets to (re)seal, e.g. after a backfill: the worker owns sealing, so other processes queue here. */
  markDirty(lod: Lod, buckets: number[], reason: string): void;
  dirtyBuckets(lod: Lod, limit: number): number[];
  recordRun(run: IngestRun): void;
  hasRun(sourceId: number, archiveRef: string): boolean;
  setCoverage(sourceId: number, tLo: number, tHi: number, status: CoverageStatus): void;
  coverage(from: number, to: number): CoverageRow[];
  layerVersions(): Record<string, number>;
  policy(tier: Tier): Policy;
  /** Every polity's map key and the render map, for painting series onto shapes (§8.6). Region groups have no polity row. */
  polityShapes(): { polities: PolityKey[]; render: PolityRender[] };
}

export type SegmentRow = {
  entityId: number;
  part: number;
  cls: TrackClass;
  category: number;
  label: string | null;
  sourceMask: number;
  /** Epoch ms. */
  tFirst: number;
  tLast: number;
  n: number;
  points: Uint8Array;
  flags: number;
  bbox: Bbox;
};

export type TrackChunkQuery = { cls: TrackClass; lod: Lod; bucket: number; bbox: Bbox; allowedMask: number };

export type TleRow = { noradId: number; epoch: number; line1: string; line2: string; name: string | null; sourceId: number; fetchedAt: number };

export interface TrackStore {
  /** Replaces a whole bucket in one transaction; returns the bytes written. */
  sealBucket(lod: Lod, bucket: number, segments: SegmentRow[], buildVersion: number): { path: string; rows: number };
  /** TRKC bytes for a tile; an empty chunk when the shard holds nothing there. */
  chunk(q: TrackChunkQuery): Uint8Array;
  segments(lod: Lod, bucket: number): SegmentRow[];
  /** Segments of buckets in [from, to) of one shard, one entity at a time, each in time order. */
  segmentsByEntity(lod: Lod, from: number, to: number): Generator<SegmentRow[]>;
  insertTles(rows: TleRow[]): number;
  /** The newest element set per object at `t` from the 30 days before it, else the oldest from the 30 days after. */
  tleAt(t: number): TleRow[];
  close(): void;
}
