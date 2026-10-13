'use client';

import { useEffect, useState } from 'react';
import type { ExoplanetPayload } from '@/lib/space/exoplanets';
import type { FleetPayload } from '@/lib/space/fleet';
import type { OuterPayload } from '@/lib/space/outer';
import type { SkyPayload } from '@/lib/space/sky';
import type { SunFrame } from '@/lib/space/sun';
import type { SurfacePayload } from '@/lib/space/surface';

/**
 * One fetch per endpoint, shared by every component that asks: the Earth sky
 * layer, the world views and the dock all read the same copy. A resource only
 * polls while something enabled is subscribed to it.
 */
function sharedResource<T>(url: string, refreshMs: (data: T | null) => number) {
  let data: T | null = null;
  let loadedAt = 0;
  let inflight: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const subscribers = new Set<(d: T | null) => void>();

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = subscribers.size ? setTimeout(load, refreshMs(data)) : null;
  };

  function load(): Promise<void> {
    if (inflight) return inflight;
    inflight = fetch(url)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`${url} ${r.status}`))))
      .then((json: T) => { data = json; loadedAt = Date.now(); subscribers.forEach(fn => fn(data)); })
      .catch(e => console.warn('[TAKIP]', e instanceof Error ? e.message : e))
      .finally(() => { inflight = null; schedule(); });
    return inflight;
  }

  /** Loads ahead of any subscriber, so a view that opens later has the data at once. */
  const prefetch = () => { if (!data && !inflight) void load(); };

  return Object.assign(function useResource(enabled: boolean): T | null {
    const [value, setValue] = useState<T | null>(data);
    useEffect(() => {
      if (!enabled) return;
      subscribers.add(setValue);
      setValue(data);
      if (!data || Date.now() - loadedAt > refreshMs(data)) load();
      else schedule();
      return () => {
        subscribers.delete(setValue);
        if (!subscribers.size && timer) { clearTimeout(timer); timer = null; }
      };
    }, [enabled]);
    return enabled ? value : null;
  }, { prefetch });
}

const MIN = 60_000;

export const useSky = sharedResource<SkyPayload>('/api/space/sky', () => 30 * MIN);

/** A cold server answers with part of the fleet and how much is still coming. */
export const useFleet = sharedResource<FleetPayload>('/api/space/fleet', d => (d && d.pending > 0 ? 12_000 : 15 * MIN));

export const useSunFrames = sharedResource<{ frames: SunFrame[] }>('/api/space/sun', () => 5 * MIN);

/** Past Neptune; asked for only once the camera heads out that far. */
export const useOuter = sharedResource<OuterPayload>('/api/space/outer', () => 6 * 60 * MIN);

export const useExoplanets = sharedResource<ExoplanetPayload>('/api/space/exoplanets', () => 12 * 60 * MIN);

const surfaces = {
  moon: sharedResource<SurfacePayload>('/api/space/surface/moon', () => 20 * MIN),
  mars: sharedResource<SurfacePayload>('/api/space/surface/mars', () => 20 * MIN),
};

export function useSurface(body: 'moon' | 'mars' | null): SurfacePayload | null {
  const moon = surfaces.moon(body === 'moon');
  const mars = surfaces.mars(body === 'mars');
  return body === 'moon' ? moon : body === 'mars' ? mars : null;
}

/** Re-renders every `ms`, for views that move with the clock. */
export function useNow(ms: number, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms, enabled]);
  return now;
}
