import { useEffect, useRef, useState } from 'react';
import { restoreDeviceLocation, takeDeviceLocation } from '@/lib/platform/device-location';
import { restoreActions, takeActions } from '@/lib/platform/usage-actions';
import { reportView } from '@/components/site/page-view';
import { arrival, visitorId } from '@/lib/platform/visitor';
import { authClient } from '../auth-client';

/** GET /api/v1/me/time (apps/api/src/access/map-time.ts); `limit` 0 means no limit. */
export type MapTime = { limit: number; used: number; remaining: number; blocked: boolean; resetsAt: string };

const TICK_MS = 60_000;
// Passes over a bounce, and keeps the opening more than the api's 50 s apart from the first tick a minute in.
const OPENING_MS = 5_000;
// Read once, as the module loads: the map rewrites the address (layers, view) soon after.
const ARRIVAL = typeof window === 'undefined' ? null : arrival();
// A map left open stops counting; watching a camera or live feed needs no input.
const IDLE_MS = 5 * 60_000;
const WATCHING = ['window:camera', 'window:feed'];
const INPUT = ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart'] as const;

async function ask(method: 'GET' | 'POST', features?: readonly string[], opening = false): Promise<MapTime | null> {
  const id = method === 'POST' ? visitorId() : null;
  const actions = method === 'POST' ? takeActions() : undefined;
  const device = method === 'POST' ? takeDeviceLocation() : undefined;
  const failed = () => {
    restoreActions(actions);
    if (device) restoreDeviceLocation();
  };
  try {
    const body = features && JSON.stringify({ opening: opening || undefined, features, actions, device, visitor: id ? { id, ...ARRIVAL } : undefined });
    const res = await fetch('/api/v1/me/time', { method, cache: 'no-store', body, headers: body ? { 'content-type': 'application/json' } : undefined });
    if (!res.ok) failed();
    return res.ok ? ((await res.json()) as MapTime) : null;
  } catch {
    failed();
    return null;
  }
}

/** Sends the actions counted and the location shared since the last tick as the page is hidden or closed; a beacon survives the unload. */
function flushActions() {
  const actions = takeActions();
  const device = takeDeviceLocation();
  if (!actions && !device) return;
  const id = visitorId();
  const body = new Blob([JSON.stringify({ actions, device, visitor: id ? { id } : undefined })], { type: 'application/json' });
  if (navigator.sendBeacon('/api/v1/me/actions', body)) return;
  restoreActions(actions);
  if (device) restoreDeviceLocation();
}

/**
 * Today's map minutes: read on load and whenever the signed-in user changes, ticked once a minute while the tab is visible
 * and in use (input in the last five minutes, or a camera or live feed open).
 * Each tick carries the features in use then (map-time-features.ts), the actions counted since (usage-actions.ts) and this
 * browser's visitor id. A few seconds after the tab is first seen, an opening tick books the minute the map opened in for
 * the admin's analytics, without spending map time.
 */
export function useMapTime(features: readonly string[] = []): MapTime | null {
  const userId = authClient.useSession().data?.user.id ?? null;
  const [state, setState] = useState<{ userId: string | null; time: MapTime } | null>(null);
  // Read by the interval, so a change of panel or layer doesn't restart the minute.
  const latest = useRef(features);
  useEffect(() => {
    latest.current = features;
  }, [features]);

  // The map's opening goes in the view log, so a visit from a public page can be seen reaching it.
  useEffect(() => reportView('/', document.documentElement.lang), []);

  useEffect(() => {
    let live = true;
    const update = (time: MapTime | null) => {
      if (live && time) setState({ userId, time });
    };
    void ask('GET').then(update);
    let opened = false;
    let opening: ReturnType<typeof setTimeout> | undefined;
    const open = () => {
      if (opened || document.visibilityState !== 'visible') return;
      opened = true;
      void ask('POST', latest.current, true).then(update);
    };
    const awaitOpening = () => {
      if (opened || document.visibilityState !== 'visible') return;
      clearTimeout(opening);
      opening = setTimeout(open, OPENING_MS);
    };
    awaitOpening();
    let lastInput = Date.now();
    const onInput = () => {
      lastInput = Date.now();
    };
    const inUse = () => Date.now() - lastInput < IDLE_MS || latest.current.some(f => WATCHING.includes(f));
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && inUse()) void ask('POST', latest.current).then(update);
    }, TICK_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushActions();
      else {
        onInput();
        awaitOpening();
      }
    };
    // Captured, so a map or window that stops an event's propagation still counts it.
    for (const type of INPUT) window.addEventListener(type, onInput, { capture: true, passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flushActions);
    return () => {
      live = false;
      clearTimeout(opening);
      clearInterval(timer);
      for (const type of INPUT) window.removeEventListener(type, onInput, { capture: true });
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flushActions);
    };
  }, [userId]);

  return state?.userId === userId ? state.time : null;
}
