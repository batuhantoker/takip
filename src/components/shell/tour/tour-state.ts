'use client';

import { useSyncExternalStore } from 'react';
import { countAction } from '@/lib/platform/usage-actions';
import { STOPS, type StopId } from './lib/stops';

const SEEN = 'takip.tour.seen';
const ASKED = 'takip.tour.resume';

export type TourSpot = { at: number; part: number | null };

let at: number | null = null;
/** The section showing inside the stop's panel, or null on the stop itself. */
let part: number | null = null;
/** Where the tour was stopped before its end; `ask` is set the first time in this browser, to offer carrying on. */
let stopped: (TourSpot & { ask: boolean }) | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

const set = (next: number | null, nextPart: number | null = null) => {
  const p = next === null ? null : nextPart;
  if (next === at && p === part) return;
  at = next;
  part = p;
  emit();
};
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function tourSeen() {
  try { return localStorage.getItem(SEEN) === '1'; } catch { return true; }
}

export function markTourSeen() {
  try { localStorage.setItem(SEEN, '1'); } catch { /* storage blocked */ }
}

/** True once per browser: the first early stop is the one asked about. */
function firstStop() {
  try {
    if (localStorage.getItem(ASKED) === '1') return false;
    localStorage.setItem(ASKED, '1');
    return true;
  } catch { return false; }
}

/** The map tour, from TI's How to or the first-visit offer, on the stop given; `inside` starts in its panel. */
export function startTour(from = 0, inside: number | null = null) {
  markTourSeen();
  stopped = null;
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
  if (at !== null) {
    countAction('tour.skip');
    stopped = { at, part, ask: firstStop() };
  }
  set(null);
}

/** Back to where the tour was stopped. */
export function resumeTour() {
  if (!stopped || at !== null) return;
  const spot = stopped;
  stopped = null;
  countAction('tour.resume');
  set(spot.at, spot.part);
}

export function forgetStop() {
  if (!stopped) return;
  stopped = null;
  emit();
}

/** Off without counting, for when the tour's layer goes away. */
export const quitTour = () => set(null);

/** On by `by` stops; past the last one the tour ends, and it never goes back before the first. */
export function stepTour(by: number) {
  if (at === null) return;
  const next = at + by;
  if (next >= STOPS.length) { countAction('tour.finish'); stopped = null; }
  set(next >= STOPS.length ? null : Math.max(0, next));
}

export const tourAt = () => at;
export const tourPart = () => part;

/** The stop showing, as its index, or null with the tour off. */
export function useTourAt() {
  return useSyncExternalStore(subscribe, () => at, () => null);
}

export const tourStopped = () => stopped;

export function useTourStopped() {
  return useSyncExternalStore(subscribe, () => stopped, () => null);
}

export function useTourPart() {
  return useSyncExternalStore(subscribe, () => part, () => null);
}

/** Whether the tour is showing this stop, for a piece that opens itself to be seen. */
export function useTourOn(id: StopId) {
  const i = useTourAt();
  return i !== null && STOPS[i].id === id;
}
