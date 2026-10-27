import type { Manifest } from './session';

/*
 * When each replayed layer has data, for the timeline: its track starts at the oldest data among the layers on,
 * and what none of them holds is hatched. Layers that hold every moment (satellites, cables) publish nothing.
 */

/** Epoch ms. */
export type Span = { from: number; to: number };
/** One layer's stretches with data; `label` is an untranslated message naming it, lower case for the middle of a list. */
export type LayerSpans = { label: string; spans: Span[] };

/** Where a class of tracks was recorded; an open span never ends. An older api doesn't say, so the whole lookback counts. */
export function trackSpans(manifest: Manifest, cls: 'vessel' | 'aircraft'): Span[] {
  const recorded = manifest.recorded?.[cls];
  if (!recorded) return [{ from: manifest.limits.earliest * 1000, to: Number.POSITIVE_INFINITY }];
  return recorded.map(([from, to]) => ({ from: from * 1000, to: to === null ? Number.POSITIVE_INFINITY : to * 1000 }));
}

/** A range this much longer than the data still names it: 24 hours for the anonymous 24 h and change. */
const SNUG = 1.1;

/**
 * Which of `ranges` (shortest first, each ending now) to offer when the layers on hold nothing before `oldest`: those
 * shorter than the data, then the one that spans it as `whole`, or null when the nearest would overshoot it.
 */
export function rangesFor<R extends { ms: number }>(ranges: readonly R[], oldest: number | undefined, now: number): { shorter: R[]; whole: R | null } {
  if (oldest === undefined) return { shorter: ranges.slice(0, -1), whole: ranges.at(-1) ?? null };
  const age = now - oldest;
  const i = ranges.findIndex(r => r.ms * SNUG >= age);
  if (i < 0) return { shorter: [...ranges], whole: null };
  return { shorter: ranges.slice(0, i), whole: ranges[i].ms <= age * SNUG ? ranges[i] : null };
}

/** The spans of every list, overlaps merged, in time order. */
export function unionSpans(lists: Span[][]): Span[] {
  const out: Span[] = [];
  for (const s of lists.flat().sort((a, b) => a.from - b.from)) {
    const last = out.at(-1);
    if (last && s.from <= last.to) last.to = Math.max(last.to, s.to);
    else if (s.to > s.from) out.push({ ...s });
  }
  return out;
}

/** Frames that each stand for `spanMs` after their time, as spans. */
export const frameSpans = (times: number[], spanMs: number) => unionSpans([times.map(t => ({ from: t, to: t + spanMs }))]);

/** The stretches of [lo, hi] outside every span (which unionSpans has merged). */
export function gapsWithin(spans: Span[], lo: number, hi: number): Span[] {
  const out: Span[] = [];
  let cursor = lo;
  for (const s of spans) {
    if (s.to <= cursor) continue;
    if (s.from >= hi) break;
    if (s.from > cursor) out.push({ from: cursor, to: s.from });
    cursor = s.to;
  }
  if (cursor < hi) out.push({ from: cursor, to: hi });
  return out;
}

/** The labels of the layers with nothing at `t`. */
export const missingAt = (layers: LayerSpans[], t: number) =>
  layers.filter(l => !l.spans.some(s => t >= s.from && t < s.to)).map(l => l.label);
