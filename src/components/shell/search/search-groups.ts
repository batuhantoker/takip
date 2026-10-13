import { kindGroup, type PlaceLike } from './places';

export interface Hit extends PlaceLike {
  /** How close to fly. */
  zoom: number;
  /** From this browser's recent places rather than the search. */
  recent?: boolean;
}

export type HitSection = { title: string; items: Hit[] };

/** Results under a heading per kind, the groups in the order their best match ranked. */
export function groupHits(hits: Hit[]): HitSection[] {
  const groups = new Map<string, Hit[]>();
  for (const h of hits) {
    const title = kindGroup(h.kind);
    const list = groups.get(title);
    if (list) list.push(h);
    else groups.set(title, [h]);
  }
  // One kind needs no heading.
  if (groups.size === 1) return [{ title: '', items: hits }];
  return [...groups].map(([title, items]) => ({ title, items }));
}
