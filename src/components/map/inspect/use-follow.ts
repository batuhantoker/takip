'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { MapRef } from '@/components/map/types';

// One thing is followed at a time, whichever card asked last.
let followed: string | null = null;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const setFollowed = (key: string | null) => { followed = key; listeners.forEach(l => l()); };
/** Cards on screen, by follow key. */
const mounted = new Map<string, number>();

/** For a subject that moves the camera itself while it animates (a tracked bus gliding along its route). */
export const isFollowed = (key: string) => followed === key;

/** The followed key, and setting it from outside a card (a shared link, TI); the card's own Follow reflects it. */
export const followedKey = () => followed;
export const followKey = setFollowed;
export const subscribeFollow = subscribe;

/** Keep the map centred on a moving thing until the person drags the map away. */
export function useFollow(mapRef: MapRef, pos: { lat: number; lng: number } | null, key: string) {
  const following = useSyncExternalStore(subscribe, () => followed === key, () => false);
  const setFollowing = useCallback((on: boolean) => {
    if (on) setFollowed(key);
    else if (followed === key) setFollowed(null);
  }, [key]);
  // A card that closes stops its follow. Checked a tick later, so a card that remounts at once (Strict Mode,
  // a moved window) keeps a follow set before it mounted, as a shared link's is.
  useEffect(() => {
    mounted.set(key, (mounted.get(key) ?? 0) + 1);
    return () => {
      mounted.set(key, (mounted.get(key) ?? 1) - 1);
      setTimeout(() => { if (!mounted.get(key) && followed === key) setFollowed(null); }, 0);
    };
  }, [key]);

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
