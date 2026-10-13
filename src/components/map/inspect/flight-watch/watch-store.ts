import { useSyncExternalStore } from 'react';
import type { WatchedFlight } from '@/lib/flights/watch';

const MAX = 6;
let watched: WatchedFlight[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

// Module scope, so the list outlives the map remounting on a theme switch.
export function watchFlight(f: WatchedFlight) {
  if (!f?.icao24 || watched.some(w => w.icao24 === f.icao24)) return;
  watched = [...watched, f].slice(-MAX);
  emit();
}

export function unwatchFlight(icao24: string) {
  if (!watched.some(w => w.icao24 === icao24)) return;
  watched = watched.filter(w => w.icao24 !== icao24);
  emit();
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => watched;
const EMPTY: WatchedFlight[] = [];

export function useWatchedFlights(): WatchedFlight[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
