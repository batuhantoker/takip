'use client';

import { useEffect, useState } from 'react';
import { FIRE_PERIMETER_SOURCE } from '@/lib/feeds/hazards/fire-perimeters';
import type { LayerHookArgs } from '@/components/map/types';

/** US wildfire perimeters (NIFC WFIGS) under the Active Fires key, fetched while it is on. */
export function useFirePerimetersLayer({ mapReady, activeLayers, setGeo }: LayerHookArgs) {
  const [features, setFeatures] = useState<GeoJSON.Feature[]>([]);
  const on = !!activeLayers.fires;

  useEffect(() => {
    if (!on) return;
    const ctrl = new AbortController();
    const load = async () => {
      try {
        const res = await fetch('/api/fires/perimeters', { signal: ctrl.signal });
        if (!res.ok) throw new Error(`answered ${res.status}`);
        setFeatures(((await res.json()) as GeoJSON.FeatureCollection).features ?? []);
      } catch (e) {
        if (!ctrl.signal.aborted) console.warn('[TAKIP] Fire perimeters failed:', e instanceof Error ? e.message : e);
      }
    };
    load();
    const refresh = setInterval(() => { if (!document.hidden) load(); }, 15 * 60_000);
    return () => { ctrl.abort(); clearInterval(refresh); };
  }, [on]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo(FIRE_PERIMETER_SOURCE, on ? features : []);
  }, [mapReady, on, features, setGeo]);
}
