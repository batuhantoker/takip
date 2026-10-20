'use client';

import { useSyncExternalStore } from 'react';
import { followKey, followedKey, subscribeFollow } from './use-follow';

/*
 * A request to find one aircraft, ship or satellite and follow it, from a shared link or from TI. The
 * map looks for it in each data update, opens its card and follows it, or gives up after a while:
 * a shared aircraft may have landed, and the feed may not have caught up with it yet.
 */

export type TrackKind = 'aircraft' | 'ship' | 'satellite';
export interface TrackTarget { kind: TrackKind; id: string }
export type TrackStatus = 'acquiring' | 'tracking' | 'not-found';
/** `watch`: a page's frame on a satellite, followed from straight above at the frame's zoom, with no card. */
export interface TrackState { target: TrackTarget; status: TrackStatus; since: number; watch?: boolean }

const KINDS: readonly TrackKind[] = ['aircraft', 'ship', 'satellite'];

let state: TrackState | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export const trackKey = (t: TrackTarget) => `${t.kind}:${t.id}`;

/** `aircraft:4bb1c2`, `ship:271000001` or `satellite:25544`, as a share link carries it. */
export function parseTrack(text: string | null | undefined): TrackTarget | null {
  const m = /^(aircraft|ship|satellite):([\w-]{1,40})$/i.exec(text?.trim() ?? '');
  if (!m) return null;
  const kind = m[1].toLowerCase() as TrackKind;
  return { kind, id: kind === 'aircraft' ? m[2].toLowerCase() : m[2] };
}

/** A link that opens the map on the target and follows it once it is in the data; the layers as this map has them. */
export function trackLink(origin: string, target: TrackTarget, view: { lat: number; lng: number; zoom: number }, layers?: string | null): string {
  const p = new URLSearchParams({ lat: view.lat.toFixed(4), lon: view.lng.toFixed(4), zoom: view.zoom.toFixed(2) });
  if (layers) p.set('layers', layers);
  p.set('track', trackKey(target));
  return `${origin}/?${p.toString().replace(/%2C/g, ',').replace(/%3A/g, ':')}`;
}

export function requestTrack(target: TrackTarget, watch = false) {
  state = { target: parseTrack(trackKey(target)) ?? target, status: 'acquiring', since: Date.now(), ...(watch ? { watch } : {}) };
  emit();
}

/** Whether `key` is followed for a watch request rather than a ride. */
export const isWatched = (key: string) => state?.status === 'tracking' && !!state.watch && trackKey(state.target) === key;

export function stopTracking() {
  const key = followedKey();
  if (key && KINDS.some(k => key.startsWith(`${k}:`))) followKey(null);
  state = null;
  emit();
}

/** What the map is following now, when it is an aircraft, ship or satellite. */
export function trackedNow(): TrackTarget | null {
  return parseTrack(followedKey());
}

export const trackStatus = (): TrackState | null => state;

/** The map's answer to the open request: found and followed, or not in the data. */
export function settleTrack(status: 'tracking' | 'not-found') {
  if (!state || state.status !== 'acquiring') return;
  state = { ...state, status };
  if (status === 'tracking') followKey(trackKey(state.target));
  emit();
}

export function subscribeTrack(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// Once the person drags away from a tracked target, the request is done.
subscribeFollow(() => {
  if (state?.status === 'tracking' && followedKey() !== trackKey(state.target)) {
    state = null;
    emit();
  }
});

export function useTrackStatus(): TrackState | null {
  return useSyncExternalStore(subscribeTrack, trackStatus, () => null);
}
