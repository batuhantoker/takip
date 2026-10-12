import { statSync } from 'node:fs';
import { HOUR_MS } from '@takip/core/time';
import { LODS, TrkFlag, TrackClass, type Lod, type TrackClassName } from '@takip/core/tracks';
import { decodeTrk1 } from '@takip/core/trk';
import { type SegmentRow, shardPeriod } from '@takip/db';
import type { IngestCtx } from '../context';
import { buildSegments, dedupe, type Fix } from '../tracks/segments';
import { BUILD_VERSION, TRACK_LAYERS } from './seal-tracks';

const CLASS_NAMES = Object.fromEntries(Object.entries(TrackClass).map(([name, code]) => [code, name])) as Record<number, TrackClassName>;

/** Is every L0 hour of this coarser bucket sealed, and is any of them newer than the bucket's own build? */
export function lodDue(ctx: IngestCtx, lod: Exclude<Lod, 0>, bucket: number): boolean {
  const hours = ctx.catalog.sealedBuckets(0, bucket, bucket + LODS[lod].bucketMs);
  if (hours.length < LODS[lod].bucketMs / HOUR_MS) return false;
  const built = ctx.catalog.sealedBucket(lod, bucket);
  return !built || hours.some(h => h.sealedAt > built.sealedAt);
}

/**
 * Builds an L1 or L2 bucket from its L0 hours (§7.3), one entity at a time so a whole day of
 * fixes is never in memory at once. L1's 6 h and L2's day both fall inside one L0 day shard.
 */
export function buildLod(ctx: IngestCtx, lod: Exclude<Lod, 0>, bucket: number) {
  const segments: SegmentRow[] = [];
  for (const parts of ctx.tracks.segmentsByEntity(0, bucket, bucket + LODS[lod].bucketMs)) {
    const fixes: Fix[] = [];
    for (const seg of parts) {
      const track = decodeTrk1(seg.points);
      for (let i = 0; i < track.n; i++) {
        fixes.push({
          t: track.t[i] * 1000,
          lon: track.lon[i],
          lat: track.lat[i],
          alt: track.alt?.[i],
          speed: track.speed?.[i],
          heading: track.heading?.[i],
          mask: seg.sourceMask,
        });
      }
    }
    const latest = parts[parts.length - 1];
    segments.push(...buildSegments({
      entityId: latest.entityId,
      cls: CLASS_NAMES[latest.cls],
      category: latest.category,
      label: latest.label,
      tIsReceive: parts.some(p => p.flags & TrkFlag.tIsReceive),
      fixes: dedupe(fixes),
    }, lod));
  }
  const points = segments.reduce((n, s) => n + s.n, 0);
  const { path, rows } = ctx.tracks.sealBucket(lod, bucket, segments, BUILD_VERSION);
  const period = shardPeriod(lod, bucket);
  ctx.catalog.markSealed(
    { lod, bucket, segments: segments.length, points, buildVersion: BUILD_VERSION, sealedAt: ctx.now() },
    { path: ctx.layout.shardKey(path), kind: 'tracks', lod, tLo: period.lo, tHi: period.hi, status: 'open', rows, bytes: statSync(path).size },
    TRACK_LAYERS,
  );
  return { lod, bucket, segments: segments.length, points };
}
