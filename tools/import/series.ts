import type { MetricInput, PointInput } from '@takip/db';
import type { Ctx, Dataset, Publish } from './context';

/**
 * Collects one source's series and writes each subject's points in one go.
 * finish() drops series the new version no longer has and returns the publish options.
 */
export class SeriesBatch {
  private metricIds = new Map<string, number>();
  private pending = new Map<string, { metricId: number; subjectType: 'entity' | 'event'; subjectId: number; points: Map<number, PointInput>; attrs?: Record<string, unknown> }>();
  private keep = new Set<number>();
  points = 0;
  tLo = Infinity;
  tHi = -Infinity;

  constructor(private readonly ctx: Ctx, private readonly ds: Dataset, readonly sourceId = ds.sourceId) {}

  metric(m: MetricInput) {
    let id = this.metricIds.get(m.code);
    if (id === undefined) this.metricIds.set(m.code, (id = this.ctx.series.ensureMetric(m)));
    return id;
  }

  /** Adds a point; null values are dropped (missing is never zero). A later point at the same t replaces the earlier. */
  add(metricId: number, subjectType: 'entity' | 'event', subjectId: number, p: PointInput, attrs?: Record<string, unknown>) {
    if (p.v === null || !Number.isFinite(p.v)) return;
    const key = `${metricId}|${subjectType}|${subjectId}`;
    let s = this.pending.get(key);
    if (!s) this.pending.set(key, (s = { metricId, subjectType, subjectId, points: new Map(), attrs }));
    s.points.set(p.t, p);
    this.tLo = Math.min(this.tLo, p.t);
    this.tHi = Math.max(this.tHi, p.t);
  }

  /** Writes everything collected so far; call it between large blocks to bound memory. */
  flush() {
    const all = [...this.pending.values()];
    this.pending.clear();
    for (let i = 0; i < all.length; i += 500) {
      this.ctx.history.transaction(() => {
        for (const s of all.slice(i, i + 500)) {
          const points = [...s.points.values()].sort((a, b) => a.t - b.t);
          this.points += points.length;
          this.keep.add(
            this.ctx.series.writeSeries({
              metricId: s.metricId,
              subjectType: s.subjectType,
              subjectId: s.subjectId,
              sourceId: this.sourceId,
              datasetId: this.ds.datasetId,
              attrs: s.attrs,
              points,
            }),
          );
        }
      })();
    }
  }

  finish(): Publish {
    this.flush();
    const dropped = this.ctx.series.dropMissing(this.sourceId, this.keep);
    this.ds.report.extra[`series:${this.sourceId}`] = { series: this.keep.size, points: this.points, metrics: this.metricIds.size, dropped };
    const code = this.ctx.catalog.prepare(`SELECT code FROM meta_source WHERE source_id = ?`).pluck().get(this.sourceId) as string;
    return {
      tLo: Number.isFinite(this.tLo) ? this.tLo : null,
      tHi: Number.isFinite(this.tHi) ? this.tHi : null,
      layers: [`series:${code}`],
    };
  }
}
