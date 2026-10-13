'use client';

import { useEffect, useSyncExternalStore } from 'react';

export type RingPos = { lat: number; lng: number };

/** Where every open window's subject is on the map, by window id. */
let rings: Record<string, RingPos> = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Puts a ring around a window's subject while the window is open. */
export function useRing(windowId: string, pos: RingPos | null) {
  const lat = pos?.lat, lng = pos?.lng;
  useEffect(() => {
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    rings = { ...rings, [windowId]: { lat, lng } };
    emit();
    return () => {
      const { [windowId]: _gone, ...rest } = rings; // eslint-disable-line @typescript-eslint/no-unused-vars
      rings = rest;
      emit();
    };
  }, [windowId, lat, lng]);
}

export const useRings = () => useSyncExternalStore(subscribe, () => rings, () => rings);
