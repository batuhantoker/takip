import { ref, type EventRef, type IndexRow } from './event-page';
import { buildStamp, pagesDb, stmt } from './store';

/**
 * The events a History topic page lists: the largest by the family's own measure (deaths, magnitude, yield) where
 * the records give one, and the first in each century or decade, so the page leads into its events across their
 * whole span. An event with a Wikipedia article or two sources (an indexed one) is picked before others in its period.
 */

export interface TopicEvents {
  largest: EventRef[];
  /** 'century' or 'decade', for the heading. */
  step: 'century' | 'decade';
  periods: EventRef[];
}

const LARGEST = 10;
const PERIODS = 16;

const held = new Map<string, { stamp: string; value: TopicEvents | null }>();

const yearOf = (ms: number) => new Date(ms).getUTCFullYear();

function yearStart(year: number): number {
  const d = new Date(0);
  d.setUTCFullYear(year, 0, 1);
  return d.getTime();
}

export function topicEvents(kinds: readonly string[]): TopicEvents | null {
  const db = pagesDb();
  if (!db || !kinds.length) return null;
  const stamp = buildStamp();
  const key = kinds.join(',');
  const hit = held.get(key);
  if (hit?.stamp === stamp) return hit.value;

  // One kind at a time, so each read walks an index in order instead of sorting the whole kind.
  const byMagnitude = stmt(db, `SELECT * FROM event WHERE kind = ? AND magnitude IS NOT NULL AND canonical_id = event_id ORDER BY magnitude DESC LIMIT ?`);
  const largest = kinds.flatMap(kind => byMagnitude.all(kind, LARGEST) as IndexRow[])
    .sort((a, b) => b.magnitude! - a.magnitude! || a.t_start - b.t_start).slice(0, LARGEST).map(ref);
  const span = kinds.map(kind => stmt(db, 'SELECT min(t_start) AS lo, max(t_start) AS hi FROM event WHERE kind = ?').get(kind) as { lo: number | null; hi: number | null })
    .filter(s => s.lo !== null && s.hi !== null) as { lo: number; hi: number }[];
  let value: TopicEvents | null = null;
  if (span.length) {
    const lo = yearOf(Math.min(...span.map(s => s.lo)));
    const hi = yearOf(Math.max(...span.map(s => s.hi)));
    const step = hi - lo > 300 ? 'century' : 'decade';
    const size = step === 'century' ? 100 : 10;
    const last = Math.floor(hi / size) * size;
    const first = Math.max(Math.floor(lo / size) * size, last - (PERIODS - 1) * size);
    const earliest = (indexed: boolean) => stmt(db, `
      SELECT * FROM event WHERE kind = ? ${indexed ? 'AND indexed = 1' : ''} AND t_start >= ? AND t_start < ? AND canonical_id = event_id
      ORDER BY t_start LIMIT 1`);
    const periods: EventRef[] = [];
    for (let y = first; y <= last; y += size) {
      const pick = (indexed: boolean) => kinds.map(kind => earliest(indexed).get(kind, yearStart(y), yearStart(y + size)) as IndexRow | undefined)
        .filter((r): r is IndexRow => !!r).sort((a, b) => a.t_start - b.t_start)[0];
      const row = pick(true) ?? pick(false);
      if (row) periods.push(ref(row));
    }
    value = { largest, step, periods };
  }
  held.set(key, { stamp, value });
  return value;
}
