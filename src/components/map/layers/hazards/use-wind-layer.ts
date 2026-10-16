'use client';

import { useEffect, useRef, useState } from 'react';
import { WIND_ATTRIBUTION, decodeWind, setWindDrawnTime, type WindField } from '@/lib/feeds/weather/wind-field';
import { createWindLayer, type WindLayer } from '@/lib/feeds/weather/wind-layer';
import { EMPTY_FC } from '@/lib/map/basemap/bands/shared';
import { stackGroundRasters } from '@/lib/map/basemap/ground-rasters';
import type { MapRef, WorldMapProps } from '@/components/map/types';

export const WIND_LAYER = 'wx-wind-particles';
const CREDIT = 'wx-wind-credit';

/** The GFS 10 m wind while the wind layer is on; null until it loads, or if the route never answers. */
function useGfsWind(active: boolean): WindField | null {
  const [field, setField] = useState<WindField | null>(null);
  useEffect(() => {
    if (!active) return;
    const ctrl = new AbortController();
    const load = async () => {
      try {
        const res = await fetch('/api/weather-field/wind', { signal: ctrl.signal });
        if (!res.ok) throw new Error(`answered ${res.status}`);
        const next = decodeWind(await res.arrayBuffer());
        setField(prev => (prev?.time === next.time ? prev : next));
      } catch (e) {
        if (!ctrl.signal.aborted) console.warn('[TAKIP] Wind field load failed:', e instanceof Error ? e.message : e);
      }
    };
    load();
    // The route moves to the next 3-hour step on its own; this just picks it up.
    const refresh = setInterval(() => { if (!document.hidden) load(); }, 15 * 60_000);
    return () => { ctrl.abort(); clearInterval(refresh); };
  }, [active]);
  return field;
}

/**
 * Wind as moving streaks over the GFS 10 m field (lib/feeds/weather/wind-layer), under the place names.
 * Returns whether the streaks are drawn; until they are, the Open-Meteo arrows stand in.
 */
export function useWindLayer({ mapRef, mapReady, activeLayers, mapStyle }: {
  mapRef: MapRef;
  mapReady: boolean;
  activeLayers: WorldMapProps['activeLayers'];
  mapStyle: string;
}): boolean {
  const on = !!activeLayers.wx_wind;
  const field = useGfsWind(on);
  const layerRef = useRef<WindLayer | null>(null);
  const drawn = on && !!field;

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    if (!drawn) {
      if (map.getLayer(WIND_LAYER)) map.removeLayer(WIND_LAYER);
      if (map.getLayer(CREDIT)) map.removeLayer(CREDIT);
      layerRef.current = null;
      setWindDrawnTime(null);
      return;
    }
    if (!layerRef.current || !map.getLayer(WIND_LAYER)) {
      layerRef.current = createWindLayer(WIND_LAYER);
      map.addLayer(layerRef.current, 'day-night-fill');
    }
    layerRef.current.setField(field);
    // A custom layer has no source to carry a credit, so an empty one carries NOAA's.
    if (!map.getSource(CREDIT)) map.addSource(CREDIT, { type: 'geojson', data: EMPTY_FC, attribution: WIND_ATTRIBUTION });
    if (!map.getLayer(CREDIT)) map.addLayer({ id: CREDIT, type: 'circle', source: CREDIT });
    stackGroundRasters(map);
    setWindDrawnTime(field!.time);
  }, [mapReady, drawn, field, mapStyle, mapRef]);

  useEffect(() => () => setWindDrawnTime(null), []);
  return drawn;
}
