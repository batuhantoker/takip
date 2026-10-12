import type { Bbox } from '@takip/core/tiles';
import type { Prec } from '@takip/core/time';

/*
 * history.db stores (replay-database.md §11.2): curated events, historical series and documents.
 * Writers are the importers and, later, the worker for revisable live events; readers are the replay routes.
 */

/** How exactly an event's anchor is known. Country means a polity-centroid fallback. */
export const GeoPrec = { none: 0, exact: 1, city: 2, area: 3, approximate: 4, country: 5 } as const;
export type GeoPrec = (typeof GeoPrec)[keyof typeof GeoPrec];

export type EventEntityRow = {
  entityId: number;
  role: string;
  side?: number;
  spell?: number;
  tLo?: number | null;
  tHi?: number | null;
  attrs?: Record<string, unknown>;
};

export type EventInput = {
  kind: string;
  sourceId: number;
  datasetId: number | null;
  sourceRecordId: string;
  /** source_record_id of the parent event in the same source. */
  parentRecordId?: string | null;
  title: string | null;
  tStart: number;
  tStartPrec: Prec;
  tEnd?: number | null;
  tEndPrec?: Prec | null;
  ongoing?: boolean;
  lon: number | null;
  lat: number | null;
  /** Defaults to the anchor point. */
  bbox?: Bbox | null;
  geom?: Uint8Array | null;
  geoPrec: GeoPrec;
  magnitude?: number | null;
  severity?: number | null;
  confidence?: number;
  attrs?: Record<string, unknown>;
  entities?: EventEntityRow[];
};

export type EventKindInput = { code: string; family: string; parent?: string; style?: Record<string, unknown> };

export type UpsertResult = { inserted: number; changed: number; unchanged: number };

export type EventCandidateQuery = {
  bbox: Bbox;
  tLo: number;
  tHi: number;
  families?: readonly string[];
  kinds?: readonly string[];
  /** Licence gating (§8.7): only these sources are returned. */
  sourceIds: ReadonlySet<number>;
  limit?: number;
};

/** A plain row for the tile encoder: t0/t1 are the expanded interval in epoch ms. */
export type EventCandidate = {
  id: number;
  kind: string;
  family: string;
  sourceId: number;
  title: string | null;
  lon: number;
  lat: number;
  t0: number;
  t1: number;
  tStart: number;
  tEnd: number | null;
  prec: number;
  ongoing: number;
  geoPrec: number;
  magnitude: number | null;
  severity: number | null;
  confidence: number;
  geom: Uint8Array | null;
};

export type EventDetail = EventCandidate & {
  sourceRecordId: string;
  canonicalId: number;
  parentId: number | null;
  endPrec: number | null;
  attrs: Record<string, unknown>;
  entities: { entityId: number; role: string; side: number; spell: number; tLo: number | null; tHi: number | null; attrs: Record<string, unknown> }[];
  relations: { rel: string; otherId: number; direction: 'out' | 'in'; confidence: number }[];
};

export type TimelineBin = { layer: string; sourceId: number; unit: 'decade' | 'year' | 'month' | 'day' | 'hour'; bin: number; n: number; magSum: number | null };

export interface EventStore {
  ensureKinds(kinds: EventKindInput[]): void;
  ensureRoles(codes: string[]): void;
  family(kind: string): string;
  /** Upsert on (source_id, source_record_id). A changed row bumps rev, so the old one lands in ev_event_history. */
  upsertEvents(rows: EventInput[], now?: number): UpsertResult;
  /** Sets retracted_at on the source's events that a new dataset version no longer contains. Returns how many. */
  retractMissing(sourceId: number, keep: ReadonlySet<string>, now?: number): number;
  eventId(sourceId: number, sourceRecordId: string): number | undefined;
  relate(fromId: number, rel: 'part_of' | 'same_as' | 'follows' | 'related', toId: number, confidence?: number, sourceId?: number): void;
  /** Drops the relations a source asserted, before it re-adds them from its current mapping. */
  clearRelations(sourceId: number): number;
  /** Points every same_as cluster at its representative: the lowest-ranked source in `preference`, then the lowest id. */
  resolveCanonical(preference: readonly number[]): number;
  /** Rebuilds agg_timeline_bin for the given layers (event families); counts top-level canonical events only. */
  rebuildTimeline(families: readonly string[]): void;

  candidates(q: EventCandidateQuery): EventCandidate[];
  event(id: number): EventDetail | undefined;
  timeline(layers: readonly string[], unit: TimelineBin['unit'], from: number, to: number, sourceIds: ReadonlySet<number>): TimelineBin[];
}

export type MetricInput = {
  code: string;
  name: string;
  unit?: string | null;
  granularity: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'irregular';
  agg?: 'sum' | 'mean' | 'last' | 'max' | 'min';
  topic?: string | null;
  attrs?: Record<string, unknown>;
};

/** ts_point.flags bits. */
export const PointFlag = { preliminary: 1, estimated: 2, imputed: 4, footnoted: 8 } as const;

export type PointInput = { t: number; v: number | null; prec?: Prec; flags?: number };

export type SeriesInput = {
  metricId: number;
  subjectType: 'entity' | 'event';
  subjectId: number;
  sourceId: number;
  datasetId: number | null;
  attrs?: Record<string, unknown>;
  points: PointInput[];
};

export type MetricRow = { metricId: number; code: string; name: string; unit: string | null; granularity: string; agg: string; topic: string | null; attrs: Record<string, unknown> };

export type SeriesPointRow = { seriesId: number; subjectType: 'entity' | 'event'; subjectId: number; sourceId: number; t: number; v: number | null; prec: number; flags: number };

export interface SeriesStore {
  ensureMetric(m: MetricInput): number;
  /** Replaces the series' points with `points`; returns the series id. */
  writeSeries(s: SeriesInput): number;
  /** Deletes the source's series that are not in `keep` (a new dataset version dropped them). */
  dropMissing(sourceId: number, keep: ReadonlySet<number>): number;
  note(text: string): number;
  linkNote(seriesId: number, t: number | null, noteId: number): void;

  metrics(topic?: string): MetricRow[];
  metric(code: string): MetricRow | undefined;
  /** Every point of a metric, gated by source. */
  points(metricCode: string, sourceIds: ReadonlySet<number>, from?: number, to?: number): SeriesPointRow[];
  /** One subject's series for a metric. */
  subjectPoints(metricCode: string, subjectType: 'entity' | 'event', subjectId: number, sourceIds: ReadonlySet<number>): SeriesPointRow[];
}

export type DocumentInput = {
  kind: 'article' | 'post' | 'report' | 'citation' | 'photo' | 'video' | 'dataset_note';
  sourceId: number;
  datasetId: number | null;
  sourceRecordId: string;
  url?: string | null;
  title?: string | null;
  summary?: string | null;
  lang?: string | null;
  publishedAt?: number | null;
  attrs?: Record<string, unknown>;
};

export type DocTarget = 'event' | 'entity' | 'feature' | 'series';
export type DocRole = 'reports' | 'depicts' | 'cites' | 'source_of' | 'mentions';

export type DocumentRow = {
  docId: number;
  kind: string;
  sourceId: number;
  url: string | null;
  title: string | null;
  summary: string | null;
  publishedAt: number | null;
  role: DocRole;
  attrs: Record<string, unknown>;
};

export interface DocStore {
  upsertDocument(d: DocumentInput, now?: number): number;
  link(docId: number, targetType: DocTarget, targetId: number, role: DocRole, confidence?: number): void;
  docsFor(targetType: DocTarget, targetId: number, sourceIds: ReadonlySet<number>): DocumentRow[];
}
