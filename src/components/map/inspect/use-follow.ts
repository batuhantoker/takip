'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { MapRef } from '@/components/map/types';

// One thing is followed at a time, whichever card asked last.
let followed: string | null = null;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const setFollowed = (key: string | null) => { followed = key; listeners.forEach(l => l()); };

/** Keep the map centred on a moving thing until the person drags the map away. */
export function useFollow(mapRef: MapRef, pos: { lat: number; lng: number } | null, key: string) {
  const following = useSyncExternalStore(subscribe, () => followed === key, () => false);
  const setFollowing = useCallback((on: boolean) => {
    if (on) setFollowed(key);
    else if (followed === key) setFollowed(null);
  }, [key]);
  // A card that closes stops its follow.
  useEffect(() => () => { if (followed === key) setFollowed(null); }, [key]);

  useEffect(() => {
    if (!following || !pos) return;
    mapRef.current?.easeTo({ center: [pos.lng, pos.lat], duration: 900 });
  }, [following, pos?.lat, pos?.lng, mapRef]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !following) return;
    const stop = (e: { originalEvent?: unknown }) => { if (e.originalEvent) setFollowing(false); };
    // Arrow keys pan like a drag; +/- only zoom, which following survives.
    const onKeyMove = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent instanceof KeyboardEvent && e.originalEvent.key.startsWith('Arrow')) setFollowing(false);
    };
    map.on('dragstart', stop);
    map.on('rotatestart', stop);
    map.on('movestart', onKeyMove);
    return () => { map.off('dragstart', stop); map.off('rotatestart', stop); map.off('movestart', onKeyMove); };
  }, [following, mapRef, setFollowing]);

  return { following, setFollowing };
}

/** How long since the feed last sent this record (each poll is a new object), on a ticking clock. */
export function useAge(record: unknown, every = 5000) {
  const [now, setNow] = useState(() => Date.now());
  const [stamp, setStamp] = useState(() => ({ record, at: now }));
  if (stamp.record !== record) setStamp({ record, at: now });
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(t);
  }, [every]);
  return Math.max(0, now - stamp.at);
}
