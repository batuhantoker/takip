import type { FlightHit } from '@/lib/feeds/aviation/flight-search';
import { kindGroup, type PlaceLike } from './places';

export interface Hit extends PlaceLike {
  /** How close to fly. */
  zoom: number;
  /** From this browser's recent places rather than the search. */
  recent?: boolean;
  /** An aircraft in the air now (kind `flight`), rather than a place. */
  flight?: FlightHit;
  /** A replayed aircraft (kind `flight`): its entity in Replay's tracks. */
  replay?: number;
}

export type HitSection = { title: string; items: Hit[] };

/** Results under a heading per kind, the groups in the order their best match ranked. `titled` keeps the heading when there is one kind. */
export function groupHits(hits: Hit[], titled = false): HitSection[] {
  const groups = new Map<string, Hit[]>();
  for (const h of hits) {
    const title = kindGroup(h.kind);
    const list = groups.get(title);
    if (list) list.push(h);
    else groups.set(title, [h]);
  }
  // One kind needs no heading.
  if (groups.size === 1 && !titled) return [{ title: '', items: hits }];
  return [...groups].map(([title, items]) => ({ title, items }));
}
