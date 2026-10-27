'use client';

import { useSyncExternalStore } from 'react';
import type { UsageAction } from '@takip/core/usage';
import { countAction } from '@/lib/platform/usage-actions';
import { SPACE_STOPS, STOPS, type AnyStop, type StopId } from './lib/stops';

const SEEN = 'takip.tour.seen';
const SPACE_SEEN = 'takip.tour.space.seen';
const ASKED = 'takip.tour.resume';

export type TourSpot = { at: number; part: number | null };

/** The map tour, or the space view's own. */
export type TourId = 'map' | 'space';
const TOURS: Record<TourId, AnyStop[]> = { map: STOPS, space: SPACE_STOPS };
const COUNTED: Record<TourId, Record<'start' | 'skip' | 'finish', UsageAction>> = {
  map: { start: 'tour.start', skip: 'tour.skip', finish: 'tour.finish' },
  space: { start: 'space_tour.start', skip: 'space_tour.skip', finish: 'space_tour.finish' },
};

let tour: TourId = 'map';
let at: number | null = null;
/** Which way the last move went, so a stop with nothing on screen is passed in the same direction. */
let heading: 1 | -1 = 1;
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

export function tourSeen(which: TourId = 'map') {
  try { return localStorage.getItem(which === 'map' ? SEEN : SPACE_SEEN) === '1'; } catch { return true; }
}

export function markTourSeen(which: TourId = 'map') {
  try { localStorage.setItem(which === 'map' ? SEEN : SPACE_SEEN, '1'); } catch { /* storage blocked */ }
}

/** True once per browser: the first early stop is the one asked about. */
function firstStop() {
  try {
    if (localStorage.getItem(ASKED) === '1') return false;
    localStorage.setItem(ASKED, '1');
    return true;
  } catch { return false; }
}

/** A tour, from TI's How to or an offer, on the stop given; `inside` starts in its panel. */
export function startTour(from = 0, inside: number | null = null, which: TourId = 'map') {
  markTourSeen(which);
  if (which === 'map') stopped = null;
  heading = 1;
  if (at === null || tour !== which) countAction(COUNTED[which].start);
  if (which === 'map' && inside !== null) countAction('tour.inside');
  if (tour !== which) {
    tour = which;
    at = null;
  }
  set(Math.min(Math.max(from, 0), TOURS[which].length - 1), inside);
}

/** Into the stop's panel on a section, or back out to the stop. */
export function setTourPart(next: number | null) {
  if (at === null) return;
  if (tour === 'map' && next !== null && part === null) countAction('tour.inside');
  set(at, next);
}

/** Stopped before the end: Escape, the card's close, or leaving for Layout settings. Only the map tour offers to carry on. */
export function endTour() {
  if (at !== null) countAction(COUNTED[tour].skip);
  if (at !== null && tour === 'map') stopped = { at, part, ask: firstStop() };
  set(null);
}

/** Back to where the tour was stopped. */
export function resumeTour() {
  if (!stopped || at !== null) return;
  const spot = stopped;
  stopped = null;
  tour = 'map';
  countAction('tour.resume');
  set(spot.at, spot.part);
}

export function forgetStop() {
  if (!stopped) return;
  stopped = null;
  emit();
}

/** Off without counting, for when the tour's layer goes away; `which` quits only that tour. */
export const quitTour = (which?: TourId) => { if (!which || which === tour) set(null); };

/** On by `by` stops; past the last one the tour ends, and it never goes back before the first. */
export function stepTour(by: number) {
  if (at === null) return;
  const next = at + by;
  const count = TOURS[tour].length;
  if (by) heading = by > 0 ? 1 : -1;
  if (next >= count) {
    countAction(COUNTED[tour].finish);
    stopped = null;
  }
  set(next >= count ? null : Math.max(0, next));
}

export const tourAt = () => at;
export const tourPart = () => part;
export const tourName = () => tour;
export const tourHeading = () => heading;
export const tourStops = () => TOURS[tour];

/** Which tour is running, or null with none. */
export function useTourName(): TourId | null {
  return useSyncExternalStore(subscribe, () => (at === null ? null : tour), () => null);
}

/** The running tour's stops; the map tour's while none runs. */
export function useTourStops(): AnyStop[] {
  return useSyncExternalStore(subscribe, () => TOURS[tour], () => STOPS);
}

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
  const stops = useTourStops();
  return i !== null && stops[i].id === id;
}
