'use client';

import { useSyncExternalStore } from 'react';
import { countAction } from '@/lib/platform/usage-actions';
import { STOPS, type StopId } from './lib/stops';

const SEEN = 'takip.tour.seen';

let at: number | null = null;
/** The section showing inside the stop's panel, or null on the stop itself. */
let part: number | null = null;
const listeners = new Set<() => void>();

const set = (next: number | null, nextPart: number | null = null) => {
  const p = next === null ? null : nextPart;
  if (next === at && p === part) return;
  at = next;
  part = p;
  listeners.forEach(l => l());
};
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function tourSeen() {
  try { return localStorage.getItem(SEEN) === '1'; } catch { return true; }
}

export function markTourSeen() {
  try { localStorage.setItem(SEEN, '1'); } catch { /* storage blocked */ }
}

/** The map tour, from TI's How to or the first-visit offer, on the stop given; `inside` starts in its panel. */
export function startTour(from = 0, inside: number | null = null) {
  markTourSeen();
  if (at === null) countAction('tour.start');
  if (inside !== null) countAction('tour.inside');
  set(Math.min(Math.max(from, 0), STOPS.length - 1), inside);
}

/** Into the stop's panel on a section, or back out to the stop. */
export function setTourPart(next: number | null) {
  if (at === null) return;
  if (next !== null && part === null) countAction('tour.inside');
  set(at, next);
}

/** Stopped before the end: Escape, the card's close, or leaving for Layout settings. */
export function endTour() {
  if (at !== null) countAction('tour.skip');
  set(null);
}

/** Off without counting, for when the tour's layer goes away. */
export const quitTour = () => set(null);

/** On by `by` stops; past the last one the tour ends, and it never goes back before the first. */
export function stepTour(by: number) {
  if (at === null) return;
  const next = at + by;
  if (next >= STOPS.length) countAction('tour.finish');
  set(next >= STOPS.length ? null : Math.max(0, next));
}

export const tourAt = () => at;
export const tourPart = () => part;

/** The stop showing, as its index, or null with the tour off. */
export function useTourAt() {
  return useSyncExternalStore(subscribe, () => at, () => null);
}

export function useTourPart() {
  return useSyncExternalStore(subscribe, () => part, () => null);
}

/** Whether the tour is showing this stop, for a piece that opens itself to be seen. */
export function useTourOn(id: StopId) {
  const i = useTourAt();
  return i !== null && STOPS[i].id === id;
}
