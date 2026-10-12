import { geoLayers } from '@takip/db';
import type { Ctx } from './context';
import { checkOverlaps } from './seed';

/** The importer half of `db:check` (§6, §11.1 rule 9): what loaded, and the invariants the engine can't enforce. */
export function check(ctx: Ctx) {
  const sources = new Map(
    (ctx.catalog.prepare(`SELECT source_id AS id, code FROM meta_source`).all() as { id: number; code: string }[]).map(s => [s.id, s.code]),
  );
  const events = ctx.history.prepare(`
    SELECT source_id AS src, count(*) AS events, sum(x0 IS NULL) AS unanchored, sum(retracted_at IS NOT NULL) AS retracted,
      sum(event_id <> canonical_id) AS merged, min(t_lo) AS lo, max(CASE WHEN t_hi < 8.64e15 THEN t_hi END) AS hi
    FROM ev_event GROUP BY source_id
  `).all() as { src: number; events: number; unanchored: number; retracted: number; merged: number; lo: number; hi: number | null }[];
  const year = (t: number | null) => (t === null ? '' : new Date(t).getUTCFullYear());
  console.log('events');
  for (const e of events)
    console.log(`  ${sources.get(e.src)?.padEnd(16)} ${String(e.events).padStart(7)}  unanchored ${e.unanchored}  retracted ${e.retracted}  merged ${e.merged}  ${year(e.lo)}–${year(e.hi)}`);
  const series = ctx.history.prepare(`
    SELECT s.source_id AS src, count(DISTINCT s.metric_id) AS metrics, count(DISTINCT s.series_id) AS series, count(*) AS points
    FROM ts_series s JOIN ts_point USING (series_id) GROUP BY s.source_id
  `).all() as { src: number; metrics: number; series: number; points: number }[];
  console.log('series');
  for (const s of series) console.log(`  ${sources.get(s.src)?.padEnd(16)} ${String(s.metrics).padStart(5)} metrics ${String(s.series).padStart(6)} series ${String(s.points).padStart(9)} points`);
  console.log('geo layers');
  for (const l of geoLayers(ctx.catalog)) console.log(`  ${l.code.padEnd(16)} v${l.version} ${l.file}`);

  const problems: string[] = [...checkOverlaps(ctx)];
  const unanchored = events.reduce((n, e) => n + e.unanchored, 0);
  if (unanchored) problems.push(`${unanchored} events without an anchor are invisible to tiles`);
  const badCanonical = ctx.history.prepare(`
    SELECT count(*) FROM ev_event e LEFT JOIN ev_event c ON c.event_id = e.canonical_id WHERE c.event_id IS NULL OR c.canonical_id <> c.event_id
  `).pluck().get() as number;
  if (badCanonical) problems.push(`${badCanonical} events point at a missing or non-canonical canonical_id`);
  ctx.history.exec(`ATTACH DATABASE '${ctx.layout.catalog.replace(/'/g, "''")}' AS cat`);
  try {
    const orphans = ctx.history.prepare(`
      SELECT count(*) FROM ev_event_entity x LEFT JOIN cat.core_entity e ON e.entity_id = x.entity_id WHERE e.entity_id IS NULL
    `).pluck().get() as number;
    if (orphans) problems.push(`${orphans} event-entity rows reference missing entities`);
    const orphanSeries = ctx.history.prepare(`
      SELECT count(*) FROM ts_series s LEFT JOIN cat.core_entity e ON e.entity_id = s.subject_id WHERE s.subject_type = 'entity' AND e.entity_id IS NULL
    `).pluck().get() as number;
    if (orphanSeries) problems.push(`${orphanSeries} series reference missing entities`);
    const unknownSources = ctx.history.prepare(`
      SELECT count(*) FROM (SELECT DISTINCT source_id FROM ev_event UNION SELECT DISTINCT source_id FROM ts_series) s
      LEFT JOIN cat.meta_source m USING (source_id) WHERE m.source_id IS NULL
    `).pluck().get() as number;
    if (unknownSources) problems.push(`${unknownSources} source ids in history.db are not in meta_source`);
  } finally {
    ctx.history.exec('DETACH DATABASE cat');
  }
  console.log(problems.length ? `problems:\n  ${problems.join('\n  ')}` : 'no problems');
  return problems;
}
