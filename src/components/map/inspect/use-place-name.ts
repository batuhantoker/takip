'use client';

import { useEffect, useState } from 'react';
import { seaName } from './format';

export interface Place {
  name: string;
  /** No address here: the name is an ocean or sea. */
  sea: boolean;
}

// The API answers per 0.1° cell at city level, so the cache keys on the same cell.
const cache = new Map<string, Place>();
const keyFor = (lat: number, lng: number) => `${(Math.round(lat * 10) / 10).toFixed(1)},${(Math.round(lng * 10) / 10).toFixed(1)}`;

/** The town or sea nearest a position, reverse-geocoded through our own route. */
export function usePlaceName(lat: number | null, lng: number | null): Place | null {
  const key = lat == null || lng == null ? null : keyFor(lat, lng);
  const [last, setLast] = useState<Place | null>(null);

  useEffect(() => {
    if (!key || cache.has(key) || lat == null || lng == null) return;
    let live = true;
    const timer = setTimeout(() => {
      fetch(`/api/geo/reverse?lat=${lat.toFixed(3)}&lng=${lng.toFixed(3)}`)
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((d: { label?: string | null }) => {
          cache.set(key, d?.label ? { name: d.label, sea: false } : { name: seaName(lat, lng), sea: true });
          if (live) setLast(cache.get(key)!);
        })
        .catch(() => { /* the coordinates still show */ });
    }, 300);
    return () => { live = false; clearTimeout(timer); };
    // lat/lng only matter through the rounded key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!key) return null;
  // While a new cell resolves, the previous place is closer to true than nothing.
  return cache.get(key) ?? last;
}

/** "Near Hoboken, New Jersey" on land, "Over the North Atlantic Ocean" at sea. */
export function describePlace(place: Place | null, atSea = 'Over the '): string | null {
  if (!place) return null;
  return place.sea ? `${atSea}${place.name}` : `Near ${place.name}`;
}
