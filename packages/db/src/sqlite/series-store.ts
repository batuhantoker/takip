import { createHash } from 'node:crypto';
import { Prec } from '@takip/core/time';
import type { MetricInput, MetricRow, SeriesInput, SeriesPointRow, SeriesStore } from '../history-stores';
import type { Db } from '../open';
import { statements } from './statements';

const POINT_COLS = `s.series_id AS seriesId, s.subject_type AS subjectType, s.subject_id AS subjectId, s.source_id AS sourceId,
  p.t, p.v, p.t_prec AS prec, p.flags`;

/** history.db historical series. Points are replaced per series, so a re-import is idempotent. */
export class SqliteSeriesStore implements SeriesStore {
  private metricIds = new Map<string, number>();

  private readonly sql: ReturnType<typeof statements>;

  constructor(readonly db: Db) {
    this.sql = statements(db);
  }

  ensureMetric(m: MetricInput) {
    const id = this.sql(`
      INSERT INTO ts_metric (code, name, unit, granularity, agg, topic, attrs) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (code) DO UPDATE SET name = excluded.name, unit = excluded.unit, granularity = excluded.granularity,
        agg = excluded.agg, topic = excluded.topic, attrs = excluded.attrs
      RETURNING metric_id
    `).pluck().get(m.code, m.name, m.unit ?? null, m.granularity, m.agg ?? 'mean', m.topic ?? null, JSON.stringify(m.attrs ?? {})) as number;
    this.metricIds.set(m.code, id);
    return id;
  }

  writeSeries(s: SeriesInput) {
    const upsert = this.sql(`
      INSERT INTO ts_series (metric_id, subject_type, subject_id, source_id, dataset_id, attrs) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (metric_id, subject_type, subject_id, source_id) DO UPDATE SET dataset_id = excluded.dataset_id, attrs = excluded.attrs
      RETURNING series_id
    `).pluck();
    const clear = this.sql(`DELETE FROM ts_point WHERE series_id = ?`);
    const ins = this.sql(`INSERT OR REPLACE INTO ts_point (series_id, t, v, t_prec, flags) VALUES (?, ?, ?, ?, ?)`);
    let id = 0;
    this.db.transaction(() => {
      id = upsert.get(s.metricId, s.subjectType, s.subjectId, s.sourceId, s.datasetId, JSON.stringify(s.attrs ?? {})) as number;
      clear.run(id);
      for (const p of s.points) ins.run(id, p.t, p.v, p.prec ?? Prec.year, p.flags ?? 0);
    })();
    return id;
  }

  dropMissing(sourceId: number, keep: ReadonlySet<number>) {
    const ids = this.sql(`SELECT series_id FROM ts_series WHERE source_id = ?`).pluck().all(sourceId) as number[];
    const drop = ids.filter(id => !keep.has(id));
    const delPoints = this.sql(`DELETE FROM ts_point WHERE series_id = ?`);
    const delNotes = this.sql(`DELETE FROM ts_point_note WHERE series_id = ?`);
    const delSeries = this.sql(`DELETE FROM ts_series WHERE series_id = ?`);
    this.db.transaction(() => {
      for (const id of drop) {
        delPoints.run(id);
        delNotes.run(id);
        delSeries.run(id);
      }
    })();
    return drop.length;
  }

  note(text: string) {
    const hash = createHash('sha1').update(text).digest();
    return this.sql(`
      INSERT INTO ts_note (hash, text) VALUES (?, ?) ON CONFLICT (hash) DO UPDATE SET text = excluded.text RETURNING note_id
    `).pluck().get(hash, text) as number;
  }

  linkNote(seriesId: number, t: number | null, noteId: number) {
    this.sql(`INSERT OR IGNORE INTO ts_point_note (series_id, t, note_id) VALUES (?, ?, ?)`).run(seriesId, t ?? -8.64e15, noteId);
  }

  private static metricRow(r: Omit<MetricRow, 'attrs'> & { attrs: string }): MetricRow {
    return { ...r, attrs: JSON.parse(r.attrs) };
  }

  metrics(topic?: string) {
    const rows = this.sql(`
      SELECT metric_id AS metricId, code, name, unit, granularity, agg, topic, attrs FROM ts_metric
      WHERE ? IS NULL OR topic = ? ORDER BY code
    `).all(topic ?? null, topic ?? null) as (Omit<MetricRow, 'attrs'> & { attrs: string })[];
    return rows.map(SqliteSeriesStore.metricRow);
  }

  metric(code: string) {
    const r = this.sql(`SELECT metric_id AS metricId, code, name, unit, granularity, agg, topic, attrs FROM ts_metric WHERE code = ?`).get(code) as
      | (Omit<MetricRow, 'attrs'> & { attrs: string })
      | undefined;
    return r && SqliteSeriesStore.metricRow(r);
  }

  points(metricCode: string, sourceIds: ReadonlySet<number>, from = -8.64e15, to = 8.64e15) {
    return this.sql(`
      SELECT ${POINT_COLS} FROM ts_metric m JOIN ts_series s USING (metric_id) JOIN ts_point p USING (series_id)
      WHERE m.code = ? AND s.source_id IN (SELECT value FROM json_each(?)) AND p.t >= ? AND p.t < ?
      ORDER BY s.series_id, p.t
    `).all(metricCode, JSON.stringify([...sourceIds]), from, to) as SeriesPointRow[];
  }

  subjectPoints(metricCode: string, subjectType: 'entity' | 'event', subjectId: number, sourceIds: ReadonlySet<number>) {
    return this.sql(`
      SELECT ${POINT_COLS} FROM ts_metric m JOIN ts_series s USING (metric_id) JOIN ts_point p USING (series_id)
      WHERE m.code = ? AND s.subject_type = ? AND s.subject_id = ? AND s.source_id IN (SELECT value FROM json_each(?))
      ORDER BY s.source_id, p.t
    `).all(metricCode, subjectType, subjectId, JSON.stringify([...sourceIds])) as SeriesPointRow[];
  }

  entityMetrics(sourceIds: ReadonlySet<number>) {
    const rows = this.sql(`
      SELECT m.metric_id AS metricId, m.code, m.name, m.unit, m.granularity, m.agg, m.topic, m.attrs, count(DISTINCT s.subject_id) AS subjects
      FROM ts_metric m JOIN ts_series s USING (metric_id)
      WHERE s.subject_type = 'entity' AND s.source_id IN (SELECT value FROM json_each(?))
      GROUP BY m.metric_id ORDER BY m.code
    `).all(JSON.stringify([...sourceIds])) as (Omit<MetricRow, 'attrs'> & { attrs: string; subjects: number })[];
    return rows.map(r => ({ ...SqliteSeriesStore.metricRow(r), subjects: r.subjects }));
  }
}
