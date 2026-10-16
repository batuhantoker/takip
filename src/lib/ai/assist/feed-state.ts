/**
 * One honest word for where a layer's feed stands, so TI never presents old, fallback or missing
 * data as live: "12 flights in view, stale". After God's Eye View's feed-state normaliser
 * (src/data/feedState.js, MIT).
 */
import type { FeedMark } from '@/lib/core/feed-log';
import { SOURCES, loaded, type FindLayer } from './catalog';

export type FeedState = 'live' | 'loading' | 'degraded' | 'stale' | 'fallback' | 'unavailable' | 'off';

export interface FeedReading {
  state: FeedState;
  /** Minutes since the data landed, where known. */
  ageMin?: number;
  note?: string;
}

/** Worst first: what a query over several layers reports. */
const RANK: FeedState[] = ['unavailable', 'stale', 'fallback', 'degraded', 'loading', 'live', 'off'];

export interface FeedInputs {
  data: Record<string, unknown>;
  /** Map layers switched on. */
  layersOn: Record<string, boolean>;
  marks: Record<string, FeedMark>;
  now?: number;
}

export function feedState(layer: FindLayer, { data, layersOn, marks, now = Date.now() }: FeedInputs): FeedReading {
  const src = SOURCES[layer];
  const mark = src.feed ? marks[src.feed.url.split('?')[0]] ?? null : null;
  const age = mark?.at ? Math.round((now - mark.at) / 60_000) : undefined;
  if (!loaded(data, layer)) {
    if (mark?.failedAt) return { state: 'unavailable', note: mark.error };
    return src.layers.some(k => layersOn[k]) || !src.layers.length ? { state: 'loading' } : { state: 'off' };
  }
  if (!mark) return { state: 'live' };
  if (mark.failedAt && mark.failedAt > (mark.at ?? 0)) return { state: 'stale', ageMin: age, note: 'the last refresh failed; showing the data from before' };
  if (mark.stale || /\+stale\b/.test(mark.source ?? '')) return { state: 'stale', ageMin: age, note: 'the source sent a cached copy' };
  if (/fallback/i.test(mark.source ?? '')) return { state: 'fallback', ageMin: age, note: `from a fallback source (${mark.source})` };
  if (mark.error) return { state: 'degraded', ageMin: age, note: mark.error };
  if (src.staleAfterMin && age !== undefined && age > src.staleAfterMin) return { state: 'stale', ageMin: age, note: `${age} min old` };
  return { state: 'live', ageMin: age };
}

export function worst(readings: FeedReading[]): FeedReading {
  return [...readings].sort((a, b) => RANK.indexOf(a.state) - RANK.indexOf(b.state))[0] ?? { state: 'live' };
}

/** "stale, 25 min old" for a summary; empty when live. */
export function feedWords(r: FeedReading): string {
  if (r.state === 'live' || r.state === 'off') return '';
  return [r.state, r.note && r.note !== `${r.ageMin} min old` ? r.note : r.ageMin !== undefined && r.state === 'stale' ? `${r.ageMin} min old` : ''].filter(Boolean).join(', ');
}

/** The layers whose feeds are not simply live, for the model's context. */
export function feedProblems(layers: FindLayer[], inputs: FeedInputs): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of layers) {
    const r = feedState(l, inputs);
    if (r.state !== 'live' && r.state !== 'off') out[l] = feedWords(r);
  }
  return out;
}
