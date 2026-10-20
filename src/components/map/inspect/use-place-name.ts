'use client';

import { useEffect, useState } from 'react';
import type { Translate } from '@/lib/core/i18n/translator';
import { geocodeCell, TOWN_RETRY_MS, TOWN_TRIES } from '@/lib/places/pointer-place';
import { seaName } from './format';

export interface Place {
  name: string;
  /** No address here: the name is an ocean or sea. */
  sea: boolean;
}

// The API answers per 0.1° cell at city level, so the cache keys on the same cell.
const cache = new Map<string, Place>();

/** The town or sea nearest a position, reverse-geocoded through our own route. */
export function usePlaceName(lat: number | null, lng: number | null): Place | null {
  const key = lat == null || lng == null ? null : geocodeCell(lat, lng).key;
  const [last, setLast] = useState<Place | null>(null);

  useEffect(() => {
    if (!key || cache.has(key) || lat == null || lng == null) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const ask = (left: number) => {
      fetch(geocodeCell(lat, lng).url)
        .then(async r => {
          if (!r.ok) throw new Error(String(r.status));
          const d = (await r.json()) as { label?: string | null };
          // A refused, failed or still-queued lookup is sent no-store: it isn't the sea, so ask again.
          if (!d?.label && r.headers.get('cache-control')?.includes('no-store')) {
            if (live && left > 1) timer = setTimeout(ask, TOWN_RETRY_MS, left - 1);
            return;
          }
          cache.set(key, d?.label ? { name: d.label, sea: false } : { name: seaName(lat, lng), sea: true });
          if (live) setLast(cache.get(key)!);
        })
        .catch(() => { /* the coordinates still show */ });
    };
    timer = setTimeout(ask, 300, TOWN_TRIES);
    return () => { live = false; clearTimeout(timer); };
    // lat/lng only matter through the rounded key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!key) return null;
  // While a new cell resolves, the previous place is closer to true than nothing.
  return cache.get(key) ?? last;
}

/** The place's name, with a sea's in the reader's language. */
export const placeName = (t: Translate, place: Place) => (place.sea ? t(place.name) : place.name);

/** "Near Hoboken, New Jersey" on land, "Over the North Atlantic Ocean" at sea. */
export function describePlace(t: Translate, place: Place | null, atSea: 'over' | 'in' | 'near' = 'over'): string | null {
  if (!place) return null;
  if (!place.sea) return t('Near {place}', { place: place.name });
  const sea = t(place.name);
  return atSea === 'in' ? t('In the {sea}', { sea }) : atSea === 'near' ? t('Near the {sea}', { sea }) : t('Over the {sea}', { sea });
}
