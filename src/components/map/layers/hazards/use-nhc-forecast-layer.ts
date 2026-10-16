'use client';

import { useEffect, useState } from 'react';
import { NHC_SOURCE } from '@/lib/feeds/hazards/nhc-forecast';
import type { LayerHookArgs } from '@/components/map/types';

/** NHC cones, tracks and forecast points under the Severe Weather key, fetched while it is on. */
export function useNhcForecastLayer({ mapReady, activeLayers, setGeo }: LayerHookArgs) {
  const [features, setFeatures] = useState<GeoJSON.Feature[]>([]);
  const on = !!activeLayers.weather;

  useEffect(() => {
    if (!on) return;
    const ctrl = new AbortController();
    const load = async () => {
      try {
        const res = await fetch('/api/weather/nhc-forecast', { signal: ctrl.signal });
        if (!res.ok) throw new Error(`answered ${res.status}`);
        setFeatures(((await res.json()) as GeoJSON.FeatureCollection).features ?? []);
      } catch (e) {
        if (!ctrl.signal.aborted) console.warn('[TAKIP] NHC forecast failed:', e instanceof Error ? e.message : e);
      }
    };
    load();
    // NHC advises every 6 hours, with intermediate updates every 3.
    const refresh = setInterval(() => { if (!document.hidden) load(); }, 10 * 60_000);
    return () => { ctrl.abort(); clearInterval(refresh); };
  }, [on]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo(NHC_SOURCE, on ? features : []);
  }, [mapReady, on, features, setGeo]);
}
