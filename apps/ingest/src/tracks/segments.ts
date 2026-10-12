import { LODS, TrackClass, TrkFlag, type Lod, type TrackClassName } from '@takip/core/tracks';
import { encodeTrk1, trk1Header } from '@takip/core/trk';
import type { SegmentRow } from '@takip/db';
import { simplify } from './simplify';

/** One position for one entity, with the source bits that reported it. Times in epoch ms. */
export type Fix = { t: number; lon: number; lat: number; alt?: number; speed?: number; heading?: number; mask: number };

export type EntityTrack = {
  entityId: number;
  cls: TrackClassName;
  category: number;
  label: string | null;
  tIsReceive: boolean;
  fixes: Fix[];
};

/** Time order, one fix per second. Fixes arrive in source merge order, and the first for a second wins. */
export function dedupe(fixes: Fix[]): Fix[] {
  const sorted = fixes
    .map((f, i) => ({ f, i, s: Math.round(f.t / 1000) }))
    .sort((a, b) => a.s - b.s || a.i - b.i);
  const out: Fix[] = [];
  let last = Number.NaN;
  for (const { f, s } of sorted) {
    if (s === last) {
      out[out.length - 1].mask |= f.mask;
      continue;
    }
    out.push({ ...f, t: s * 1000 });
    last = s;
  }
  return out;
}

/** Runs the client may interpolate within: split at silences over `maxGapS` and where the antimeridian is crossed. */
export function splitRuns(fixes: Fix[], maxGapS: number): Fix[][] {
  const runs: Fix[][] = [];
  let run: Fix[] = [];
  for (const f of fixes) {
    const prev = run[run.length - 1];
    if (prev && (f.t - prev.t > maxGapS * 1000 || Math.abs(f.lon - prev.lon) > 180)) {
      runs.push(run);
      run = [];
    }
    run.push(f);
  }
  if (run.length) runs.push(run);
  return runs;
}

/** An entity's segments for one bucket at `lod`. `fixes` must already be deduped. */
export function buildSegments(track: EntityTrack, lod: Lod): SegmentRow[] {
  const spec = LODS[lod];
  return splitRuns(track.fixes, spec.maxGapS[track.cls]).map((run, part) => {
    const kept = simplify(run.map(f => ({ ...f, t: f.t / 1000 })), spec);
    const bbox = { w: Infinity, s: Infinity, e: -Infinity, n: -Infinity };
    let mask = 0;
    for (const f of run) {
      bbox.w = Math.min(bbox.w, f.lon);
      bbox.e = Math.max(bbox.e, f.lon);
      bbox.s = Math.min(bbox.s, f.lat);
      bbox.n = Math.max(bbox.n, f.lat);
      mask |= f.mask;
    }
    const points = encodeTrk1(kept, { scale: spec.scale, extraFlags: track.tIsReceive ? TrkFlag.tIsReceive : 0 });
    return {
      entityId: track.entityId,
      part,
      cls: TrackClass[track.cls],
      category: track.category,
      label: track.label,
      sourceMask: mask,
      tFirst: run[0].t,
      tLast: run[run.length - 1].t,
      n: kept.length,
      points,
      flags: trk1Header(points).flags,
      bbox,
    };
  });
}
