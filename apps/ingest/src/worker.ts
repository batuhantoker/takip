import { existsSync } from 'node:fs';
import { controlFile, writeControl } from '@takip/archive/control';
import { archivedHours } from '@takip/archive/reader';
import { Recorder } from '@takip/archive/recorder';
import { DAY_MS, floorTo, HOUR_MS } from '@takip/core/time';
import { isProvisional, LODS, SEAL_DELAY_MS } from '@takip/core/tracks';
import { pollUsgs } from './backfill/usgs';
import { EVENT_SOURCES, LIVE_TRACK_SOURCES } from './connectors';
import type { IngestCtx } from './context';
import { acquireLock, lockPath } from './lock';
import { buildLod, lodDue } from './jobs/build-lod';
import { eventRef, HOUR_SETTLED_MS, ingestEventHours } from './jobs/ingest-events';
import { sealHours } from './jobs/seal-hours';
import { ingestTleHour, tleRef } from './jobs/ingest-tle';
import { startKeepalive } from './jobs/keepalive';
import { sealHour } from './jobs/seal-tracks';

const TICK_MS = 60_000;
/** Recorded hours sealed per tick, so a long catch-up still yields to the other jobs. Empty hours are free. */
const MAX_SEALS = 6;
const MAX_TLE_HOURS = 24;
const MAX_EVENT_HOURS = 24;
/** Coarser buckets are checked over this window each tick; older ones are rebuilt by `rebuild`. */
const LOD_WINDOW_MS = 3 * DAY_MS;
/** How often the hours that aren't final yet are sealed provisionally, so replay reaches almost to now. */
const PROVISIONAL_EVERY_MS = 5 * 60_000;
const lastProvisional = new Map<string, number>();

const writtenControl = new Map<string, string>();

/** The recorder reads switches from control.json; catalog.db is where the admin console sets them. */
export function syncControl(ctx: IngestCtx) {
  const sources = Object.fromEntries(ctx.catalog.sources().map(s => [s.code, { record: s.record }]));
  const json = JSON.stringify(sources);
  if (writtenControl.get(ctx.archiveDir) === json && existsSync(controlFile(ctx.archiveDir))) return;
  writeControl(ctx.archiveDir, sources, ctx.now());
  writtenControl.set(ctx.archiveDir, json);
}

/** Sources the worker fetches itself rather than through the web app's routes. */
export type LiveFetch = { rec: Recorder; get?: typeof fetch };

export async function tick(ctx: IngestCtx, live?: LiveFetch) {
  syncControl(ctx);
  const now = ctx.now();

  // Its own try: a USGS outage mustn't hold up sealing.
  if (live && ctx.catalog.source('usgs')?.record) {
    try {
      const hours = await pollUsgs(live.rec, ctx.archiveDir, { get: live.get, now: ctx.now, log: ctx.log });
      const r = await ingestEventHours(ctx, 'usgs', hours);
      if (r?.inserted || r?.changed || r?.retracted) ctx.log(`USGS: ${r.inserted} new, ${r.changed} revised and ${r.retracted} renamed quakes`);
    } catch (error) {
      ctx.log(`USGS poll failed: ${(error as Error).message}`);
    }
  }

  // Every hour from the first recorded day on is sealed, recorded or not: an hour without files becomes an
  // empty bucket with not_recording coverage, so the timeline shows the gap and L1/L2 can still complete.
  // Live sources only: one backfilled day in January must not make the worker seal every hour since.
  const recorded = new Set<number>();
  for (const src of LIVE_TRACK_SOURCES) for (const h of await archivedHours(ctx.archiveDir, src)) recorded.add(h);
  if (recorded.size) {
    const first = floorTo(Math.min(...recorded), DAY_MS);
    const last = floorTo(now - SEAL_DELAY_MS, HOUR_MS);
    // Provisional seals don't count: once an hour is final it is sealed again.
    const sealed = new Set(ctx.catalog.sealedBuckets(0, first, last + 1).filter(b => !isProvisional(0, b.bucket, b.sealedAt)).map(b => b.bucket));
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

  // The hours not final yet, sealed early and again every few minutes, plus their incomplete L1 and L2 buckets.
  if (recorded.size && now - (lastProvisional.get(ctx.archiveDir) ?? 0) >= PROVISIONAL_EVERY_MS) {
    lastProvisional.set(ctx.archiveDir, now);
    const first = Math.max(floorTo(now - SEAL_DELAY_MS, HOUR_MS) + HOUR_MS, floorTo(Math.min(...recorded), HOUR_MS));
    const hours: number[] = [];
    for (let hour = first; hour <= floorTo(now, HOUR_MS); hour += HOUR_MS) hours.push(hour);
    for (const hour of hours) await sealHour(ctx, hour);
    for (const lod of [1, 2] as const) {
      for (const bucket of new Set(hours.map(h => floorTo(h, LODS[lod].bucketMs)))) buildLod(ctx, lod, bucket);
    }
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

  for (const code of Object.keys(EVENT_SOURCES)) {
    const source = ctx.catalog.source(code);
    if (!source?.build) continue;
    const due = (await archivedHours(ctx.archiveDir, code))
      .filter(h => h + HOUR_SETTLED_MS <= now && !ctx.catalog.hasRun(source.sourceId, eventRef(code, h)))
      .slice(0, MAX_EVENT_HOURS);
    const r = await ingestEventHours(ctx, code, due);
    if (r) ctx.log(`${code}: loaded ${due.length} hours, ${r.inserted} new and ${r.changed} revised events of ${r.records}`);
  }
}

const iso = (t: number) => new Date(t).toISOString().slice(0, 16);

export async function runWorker(ctx: IngestCtx, { webUrl }: { webUrl?: string }) {
  const release = acquireLock(lockPath(ctx));
  // Sources not in the catalogue default to on, as the recorder treats them.
  const recording = (code: string) => ctx.catalog.source(code)?.record ?? true;
  const stopKeepalive = webUrl ? startKeepalive(webUrl, recording, ctx.log) : undefined;
  const rec = new Recorder({ dir: ctx.archiveDir, log: ctx.log }).start();
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
        await tick(ctx, { rec });
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
    await rec.close();
    release();
    ctx.close();
    ctx.log('worker stopped');
  }
}
