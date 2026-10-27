import { TRACK_SOURCE_CLASS, type TrackClassName } from '@takip/core/tracks';
import type { CoverageRow } from '@takip/db';

/** Epoch seconds; `to` is null while the span is still open. */
export type RecordedSpan = [from: number, to: number | null];

/**
 * When each track class was recorded since `from` (epoch ms), its sources' ok and degraded coverage merged.
 * One source quiet while another of its class recorded is not a gap, so only what's left between spans is.
 * Ends are not cut at now: the current hour is covered to its end, and a cut would read as a gap a minute later.
 */
export function recordedSpans(rows: CoverageRow[], from: number): Record<TrackClassName, RecordedSpan[]> {
  const spans: Record<TrackClassName, [number, number][]> = { vessel: [], aircraft: [] };
  for (const r of rows) {
    const cls = TRACK_SOURCE_CLASS[r.source];
    if (!cls || (r.status !== 'ok' && r.status !== 'degraded')) continue;
    const lo = Math.max(r.tLo, from);
    const hi = r.tHi ?? Number.POSITIVE_INFINITY;
    if (hi > lo) spans[cls].push([lo, hi]);
  }
  const merge = (list: [number, number][]): RecordedSpan[] => {
    const out: [number, number][] = [];
    for (const [lo, hi] of list.sort((a, b) => a[0] - b[0])) {
      const last = out.at(-1);
      if (last && lo <= last[1]) last[1] = Math.max(last[1], hi);
      else out.push([lo, hi]);
    }
    return out.map(([lo, hi]) => [lo / 1000, Number.isFinite(hi) ? hi / 1000 : null]);
  };
  return { vessel: merge(spans.vessel), aircraft: merge(spans.aircraft) };
}
