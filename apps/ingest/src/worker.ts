import { existsSync } from 'node:fs';
import { controlFile, writeControl } from '@takip/archive/control';
import { archivedHours } from '@takip/archive/reader';
import { DAY_MS, floorTo, HOUR_MS } from '@takip/core/time';
import { LODS } from '@takip/core/tracks';
import { LIVE_TRACK_SOURCES } from './connectors';
import type { IngestCtx } from './context';
import { acquireLock, lockPath } from './lock';
import { buildLod, lodDue } from './jobs/build-lod';
import { sealHours } from './jobs/seal-hours';
import { ingestTleHour, tleRef } from './jobs/ingest-tle';
import { startKeepalive } from './jobs/keepalive';
import { SEAL_DELAY_MS, sealHour } from './jobs/seal-tracks';

const TICK_MS = 60_000;
/** Recorded hours sealed per tick, so a long catch-up still yields to the other jobs. Empty hours are free. */
const MAX_SEALS = 6;
const MAX_TLE_HOURS = 24;
/** Coarser buckets are checked over this window each tick; older ones are rebuilt by `rebuild`. */
const LOD_WINDOW_MS = 3 * DAY_MS;
/** An archive hour stops changing once the recorder's last flush for it has landed. */
const HOUR_SETTLED_MS = HOUR_MS + 5 * 60_000;

const writtenControl = new Map<string, string>();

/** The recorder reads switches from control.json; catalog.db is where the admin console sets them. */
export function syncControl(ctx: IngestCtx) {
  const sources = Object.fromEntries(ctx.catalog.sources().map(s => [s.code, { record: s.record }]));
  const json = JSON.stringify(sources);
  if (writtenControl.get(ctx.archiveDir) === json && existsSync(controlFile(ctx.archiveDir))) return;
  writeControl(ctx.archiveDir, sources, ctx.now());
  writtenControl.set(ctx.archiveDir, json);
}

export async function tick(ctx: IngestCtx) {
  syncControl(ctx);
  const now = ctx.now();

  // Every hour from the first recorded day on is sealed, recorded or not: an hour without files becomes an
  // empty bucket with not_recording coverage, so the timeline shows the gap and L1/L2 can still complete.
  // Live sources only: one backfilled day in January must not make the worker seal every hour since.
  const recorded = new Set<number>();
  for (const src of LIVE_TRACK_SOURCES) for (const h of await archivedHours(ctx.archiveDir, src)) recorded.add(h);
  if (recorded.size) {
    const first = floorTo(Math.min(...recorded), DAY_MS);
    const last = floorTo(now - SEAL_DELAY_MS, HOUR_MS);
    const sealed = new Set(ctx.catalog.sealedBuckets(0, first, last + 1).map(b => b.bucket));
    let withData = 0;
    let empty = 0;
    for (let hour = first; hour <= last && withData < MAX_SEALS; hour += HOUR_MS) {
      if (sealed.has(hour)) continue;
      const s = await sealHour(ctx, hour);
      if (recorded.has(hour)) {
        withData++;
        ctx.log(`sealed ${iso(hour)}: ${s.entities} entities, ${s.segments} segments, ${s.points} points`);
      } else {
        empty++;
      }
    }
    if (empty) ctx.log(`sealed ${empty} hours with nothing recorded`);
  }

  // Hours other processes queued (backfills, rebuilds): this worker is the one writer of identities and shards.
  const dirty = ctx.catalog.dirtyBuckets(0, MAX_SEALS);
  if (dirty.length) {
    await sealHours(ctx, dirty, { lods: true });
    ctx.log(`resealed ${dirty.length} queued hours from ${iso(dirty[0])}`);
  }

  for (const lod of [1, 2] as const) {
    const size = LODS[lod].bucketMs;
    for (let bucket = floorTo(now - LOD_WINDOW_MS, size); bucket < now; bucket += size) {
      if (!lodDue(ctx, lod, bucket)) continue;
      const r = buildLod(ctx, lod, bucket);
      ctx.log(`built L${lod} ${iso(bucket)}: ${r.segments} segments, ${r.points} points`);
    }
  }

  const celestrak = ctx.catalog.source('celestrak');
  if (celestrak?.build) {
    const due = (await archivedHours(ctx.archiveDir, 'celestrak'))
      .filter(h => h + HOUR_SETTLED_MS <= now && !ctx.catalog.hasRun(celestrak.sourceId, tleRef(h)))
      .slice(0, MAX_TLE_HOURS);
    for (const hour of due) {
      const r = await ingestTleHour(ctx, hour);
      if (r) ctx.log(`TLEs ${iso(hour)}: ${r.inserted} new of ${r.records}`);
    }
  }
}

const iso = (t: number) => new Date(t).toISOString().slice(0, 16);

export async function runWorker(ctx: IngestCtx, { webUrl }: { webUrl?: string }) {
  const release = acquireLock(lockPath(ctx));
  // Sources not in the catalogue default to on, as the recorder treats them.
  const recording = (code: string) => ctx.catalog.source(code)?.record ?? true;
  const stopKeepalive = webUrl ? startKeepalive(webUrl, recording, ctx.log) : undefined;
  ctx.log(`worker started (archive ${ctx.archiveDir}${webUrl ? `, keeping ${webUrl} polling` : ''})`);
  let stopping = false;
  let wake: (() => void) | undefined;
  const stop = () => {
    stopping = true;
    wake?.();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    while (!stopping) {
      try {
        await tick(ctx);
      } catch (error) {
        ctx.log(`tick failed: ${(error as Error).stack ?? error}`);
      }
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, TICK_MS);
        wake = () => {
          clearTimeout(timer);
          resolve();
        };
      });
    }
  } finally {
    stopKeepalive?.();
    release();
    ctx.close();
    ctx.log('worker stopped');
  }
}
