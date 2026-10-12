import { isEnvelope } from '@takip/archive/envelope';
import { readSourceHour } from '@takip/archive/reader';
import type { TleRow } from '@takip/db';
import { celestrak } from '../connectors/celestrak';
import type { IngestCtx } from '../context';

export const tleRef = (hour: number) => `celestrak/${new Date(hour).toISOString().slice(0, 13)}`;

/** Loads one archived hour of CelesTrak element sets into tracks/tle.db; orbit history is append-only. */
export async function ingestTleHour(ctx: IngestCtx, hour: number) {
  const source = ctx.catalog.source('celestrak');
  if (!source?.build) return undefined;
  const startedAt = ctx.now();
  const rows: TleRow[] = [];
  for await (const line of readSourceHour(ctx.archiveDir, 'celestrak', hour, { onIssue: ctx.log })) {
    if (!isEnvelope(line)) continue;
    for (const obs of celestrak.map(line)) {
      if (obs.shape === 'tle') {
        rows.push({ noradId: obs.norad, epoch: obs.epoch, line1: obs.line1, line2: obs.line2, name: obs.name, sourceId: source.sourceId, fetchedAt: line.at });
      }
    }
  }
  const inserted = ctx.tracks.insertTles(rows);
  ctx.catalog.recordRun({ sourceId: source.sourceId, startedAt, finishedAt: ctx.now(), status: 'ok', records: rows.length, inserted, archiveRef: tleRef(hour) });
  return { hour, records: rows.length, inserted };
}
