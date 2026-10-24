'use client';

import { useSyncExternalStore } from 'react';
import { STOPS, type StopId } from './lib/stops';

const SEEN = 'takip.tour.seen';

let at: number | null = null;
const listeners = new Set<() => void>();

const set = (next: number | null) => {
  if (next === at) return;
  at = next;
  listeners.forEach(l => l());
};

export function tourSeen() {
  try { return localStorage.getItem(SEEN) === '1'; } catch { return true; }
}

export function markTourSeen() {
  try { localStorage.setItem(SEEN, '1'); } catch { /* storage blocked */ }
}

/** The map tour, from TI's How to or the first-visit offer, on the stop given. */
export function startTour(from = 0) {
  markTourSeen();
  set(Math.min(Math.max(from, 0), STOPS.length - 1));
}

export const endTour = () => set(null);

/** On by `by` stops; past the last one the tour ends, and it never goes back before the first. */
export function stepTour(by: number) {
  if (at === null) return;
  const next = at + by;
  set(next >= STOPS.length ? null : Math.max(0, next));
}

export const tourAt = () => at;

/** The stop showing, as its index, or null with the tour off. */
export function useTourAt() {
  return useSyncExternalStore(
    l => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => at,
    () => null,
  );
}

/** Whether the tour is showing this stop, for a piece that opens itself to be seen. */
export function useTourOn(id: StopId) {
  const i = useTourAt();
  return i !== null && STOPS[i].id === id;
}
