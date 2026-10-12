import { floorTo } from '@takip/core/time';
import { LODS } from '@takip/core/tracks';
import type { IngestCtx } from '../context';
import { acquireLock, lockPath } from '../lock';
import { buildLod, lodDue } from './build-lod';
import { sealHour } from './seal-tracks';

/** Seals L0 hours and, with `lods`, rebuilds the L1/L2 buckets that now have all their hours. */
export async function sealHours(ctx: IngestCtx, hours: number[], { lods }: { lods: boolean }) {
  const sealed = [];
  for (const hour of hours) sealed.push(await sealHour(ctx, hour));
  const built = [];
  if (lods) {
    for (const lod of [1, 2] as const) {
      for (const bucket of new Set(hours.map(h => floorTo(h, LODS[lod].bucketMs)))) {
        if (lodDue(ctx, lod, bucket)) built.push(buildLod(ctx, lod, bucket));
      }
    }
  }
  return { sealed, built };
}

/**
 * Seals here when no worker is running; otherwise queues the hours for it. Two processes creating
 * entities at once would each miss the other's in the worker's id cache and duplicate identities.
 */
export async function sealOrQueue(ctx: IngestCtx, hours: number[], reason: string, { lods }: { lods: boolean }) {
  let release: () => void;
  try {
    release = acquireLock(lockPath(ctx));
  } catch {
    ctx.catalog.markDirty(0, hours, reason);
    return { queued: hours.length, sealed: [], built: [] };
  }
  try {
    return { queued: 0, ...(await sealHours(ctx, hours, { lods })) };
  } finally {
    release();
  }
}
