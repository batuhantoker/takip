'use client';

import { useEffect, useSyncExternalStore } from 'react';

/*
 * The aircraft with a card open, for the nearby flights refresh to keep fresh wherever the map is. The card
 * publishes where the plane is; the refresh reads it at each poll. With several open, the last one opened.
 */

const open = new Map<string, { lat: number; lng: number }>();
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
let focus: string | null = null;

function update() {
  const last = [...open.keys()].at(-1) ?? null;
  if (last === focus) return;
  focus = last;
  listeners.forEach(l => l());
}

/** Publishes an open card's aircraft and keeps its position current, until the card closes. */
export function useAircraftFocus(icao24: string, lat: number, lng: number) {
  useEffect(() => {
    if (!icao24) return;
    open.set(icao24, { lat, lng });
    update();
  }, [icao24, lat, lng]);
  useEffect(() => {
    if (!icao24) return;
    return () => { open.delete(icao24); update(); };
  }, [icao24]);
}

/** The focused aircraft's icao24; it changes only when another card opens or this one closes. */
export const useFocusedAircraft = () => useSyncExternalStore(subscribe, () => focus, () => null);

/** Where the focused aircraft was last seen. */
export const focusPosition = () => (focus ? open.get(focus) ?? null : null);
