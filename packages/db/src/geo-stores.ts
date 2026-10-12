import type { Bbox } from '@takip/core/tiles';
import type { Geometry } from './geo/geometry';

/*
 * Reference layers (replay-database.md §8.5): one geo/<layer>@<v>.db per version, built by an importer and
 * published by rename. Each feature is stored whole, plus pre-generalised pieces per zoom band for tiles.
 */

export type FeatureInput = {
  entityId?: number | null;
  sourceRecordId?: string | null;
  /** Validity in epoch ms; omitted means "always". */
  validLo?: number;
  validHi?: number | null;
  tPrec?: number;
  /** 0 shows from the layer's minzoom; higher tiers only at closer zooms (the route maps zoom → max tier). */
  tier?: number;
  props?: Record<string, unknown>;
  geom: Geometry;
};

export type GeoLayerSpec = {
  code: string;
  sourceId: number;
  geomKind: 'point' | 'line' | 'polygon' | 'mixed';
  timeMode: 'static' | 'valid';
  /** Feature props the tile encoder should copy into MVT properties. */
  tileProps: string[];
  minzoom?: number;
  maxzoom?: number;
  style?: Record<string, unknown>;
  /** Keep a box for polygons that vanish at low zoom (choropleth layers need every cell). */
  keepSmall?: boolean;
};

export type PublishedLayer = { code: string; version: number; path: string; features: number; pieces: number; bytes: number };

export type PieceQuery = { bbox: Bbox; z: number; tLo?: number; tHi?: number; maxTier?: number; limit?: number };

/** One tile-ready piece: geometry is WKB, already simplified for the band and at most 256 vertices. */
export type PieceRow = {
  genId: number;
  featureId: number;
  entityId: number | null;
  sourceRecordId: string | null;
  part: number;
  validLo: number;
  validHi: number | null;
  tPrec: number;
  tier: number;
  props: Record<string, unknown>;
  geom: Uint8Array;
};

export type LayerRow = {
  code: string;
  sourceId: number;
  file: string;
  version: number;
  geomKind: string;
  minzoom: number;
  maxzoom: number;
  timeMode: string;
  tileProps: string[];
  style: Record<string, unknown>;
};

export interface FeatureStore {
  pieces(q: PieceQuery): PieceRow[];
  feature(featureId: number): (Omit<PieceRow, 'genId' | 'part'> & { geom: Uint8Array }) | undefined;
  meta(): Record<string, string>;
  close(): void;
}
