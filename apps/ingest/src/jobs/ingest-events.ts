import { isEnvelope } from '@takip/archive/envelope';
import { readSourceHour } from '@takip/archive/reader';
import type { EventInput } from '@takip/db';
import { CONNECTORS, EVENT_SOURCES } from '../connectors';
import type { IngestCtx } from '../context';

export const eventRef = (code: string, hour: number) => `${code}/${new Date(hour).toISOString().slice(0, 13)}`;

/** An hour file stops growing once the recorder's last flush for it has landed. */
export const HOUR_SETTLED_MS = 3_600_000 + 5 * 60_000;

/**
 * Loads archived hours of an event source into history.db, then rebuilds the timeline bins once.
 * Upserts are idempotent, so an hour still being written can be loaded again; only a settled one is
 * recorded as a run, which is what the worker checks.
 */
export async function ingestEventHours(ctx: IngestCtx, code: string, hours: readonly number[]) {
  const source = ctx.catalog.source(code);
  const connector = CONNECTORS[code];
  if (!source?.build || !connector || !hours.length) return undefined;
  const store = ctx.events();
  let records = 0;
  let inserted = 0;
  let changed = 0;
  let retracted = 0;
  for (const hour of hours) {
    const startedAt = ctx.now();
    // Within an hour the latest fetch wins; a backfill can land in an hour after its live lines.
    const latest = new Map<string, { at: number; row: EventInput; supersedes: string[] }>();
    for await (const line of readSourceHour(ctx.archiveDir, code, hour, { onIssue: ctx.log })) {
      if (!isEnvelope(line)) continue;
      for (const obs of connector.map(line)) {
        if (obs.shape !== 'event') continue;
        const seen = latest.get(obs.sourceRecordId);
        if (!seen || line.at >= seen.at) {
          latest.set(obs.sourceRecordId, { at: line.at, row: { ...obs, sourceId: source.sourceId, datasetId: null }, supersedes: obs.supersedes ?? [] });
        }
      }
    }
    // Newest first: an id a newer observation replaced is retracted, never upserted, since an upsert revives it.
    const rows: EventInput[] = [];
    const replaced = new Set<string>();
    for (const v of [...latest.values()].sort((a, b) => b.at - a.at)) {
      if (replaced.has(v.row.sourceRecordId)) continue;
      rows.push(v.row);
      for (const id of v.supersedes) replaced.add(id);
    }
    for (const r of rows) replaced.delete(r.sourceRecordId);
    // A fresh history.db lacks the seed's kinds; codes are family.subkind.
    for (const kind of new Set(rows.map(r => r.kind))) {
      try {
        store.family(kind);
      } catch {
        store.ensureKinds([{ code: kind, family: kind.split('.')[0] }]);
      }
    }
    const r = store.upsertEvents(rows, ctx.now());
    records += rows.length;
    inserted += r.inserted;
    changed += r.changed;
    retracted += store.retract(source.sourceId, [...replaced], ctx.now());
    if (hour + HOUR_SETTLED_MS <= ctx.now()) {
      ctx.catalog.recordRun({ sourceId: source.sourceId, startedAt, finishedAt: ctx.now(), status: 'ok', records: rows.length, inserted: r.inserted, archiveRef: eventRef(code, hour) });
    }
  }
  if (inserted || changed || retracted) store.rebuildTimeline(EVENT_SOURCES[code] ?? []);
  return { records, inserted, changed, retracted };
}
