import { useEffect, useRef, useState } from 'react';
import { restoreDeviceLocation, takeDeviceLocation } from '@/lib/platform/device-location';
import { restoreActions, takeActions } from '@/lib/platform/usage-actions';
import { arrival, visitorId } from '@/lib/platform/visitor';
import { authClient } from '../auth-client';

/** GET /api/v1/me/time (apps/api/src/access/map-time.ts); `limit` 0 means no limit. */
export type MapTime = { limit: number; used: number; remaining: number; blocked: boolean; resetsAt: string };

const TICK_MS = 60_000;
// Read once, as the module loads: the map rewrites the address (layers, view) soon after.
const ARRIVAL = typeof window === 'undefined' ? null : arrival();

async function ask(method: 'GET' | 'POST', features?: readonly string[]): Promise<MapTime | null> {
  const id = method === 'POST' ? visitorId() : null;
  const actions = method === 'POST' ? takeActions() : undefined;
  const device = method === 'POST' ? takeDeviceLocation() : undefined;
  const failed = () => {
    restoreActions(actions);
    if (device) restoreDeviceLocation();
  };
  try {
    const body = features && JSON.stringify({ features, actions, device, visitor: id ? { id, ...ARRIVAL } : undefined });
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
 * Today's map minutes: read on load and whenever the signed-in user changes, ticked once a minute while the tab is visible.
 * Each tick carries the features in use then (map-time-features.ts), the actions counted since (usage-actions.ts) and this
 * browser's visitor id.
 */
export function useMapTime(features: readonly string[] = []): MapTime | null {
  const userId = authClient.useSession().data?.user.id ?? null;
  const [state, setState] = useState<{ userId: string | null; time: MapTime } | null>(null);
  // Read by the interval, so a change of panel or layer doesn't restart the minute.
  const latest = useRef(features);
  useEffect(() => {
    latest.current = features;
  }, [features]);

  useEffect(() => {
    let live = true;
    const update = (time: MapTime | null) => {
      if (live && time) setState({ userId, time });
    };
    void ask('GET').then(update);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void ask('POST', latest.current).then(update);
    }, TICK_MS);
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushActions();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flushActions);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flushActions);
    };
  }, [userId]);

  return state?.userId === userId ? state.time : null;
}
