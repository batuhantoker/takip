'use client';

import { useEffect } from 'react';
import { activeLocale } from '@/lib/core/i18n/active';
import { clearPlan, drawPlan, planUrl } from '@/lib/places/attractions/plan-layers';
import type { MapRef } from '@/components/map/types';

/** The day plan a place page frames (EmbedSpec.plan), outlined over the map. */
export function usePlanRoute({ mapRef, mapReady, plan }: { mapRef: MapRef; mapReady: boolean; plan: string | null }) {
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !plan) return;
    const ctl = new AbortController();
    fetch(planUrl(plan, activeLocale()), { signal: ctl.signal })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: GeoJSON.FeatureCollection) => drawPlan(map, data))
      .catch(() => { /* Without it the frame still shows the place. */ });
    return () => {
      ctl.abort();
      if (map.style) clearPlan(map);
    };
  }, [mapReady, mapRef, plan]);
}
