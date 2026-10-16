'use client';

import { useEffect } from 'react';
import { setTransitData, setTransitVisible, TRANSIT_CITY_SOURCE, transitCityFeatures, transitFeatures } from '@/lib/feeds/transit/map-layers';
import type { TransitCities } from '@/lib/feeds/transit/modes';
import { clampView, TRANSIT_MIN_ZOOM, TRANSIT_REFRESH_MS, type TransitResponse } from '@/lib/feeds/transit/view';
import type { MapRef, WorldMapProps } from '@/components/map/types';

interface TransitLayerArgs {
  mapRef: MapRef;
  mapReady: boolean;
  activeLayers: WorldMapProps['activeLayers'];
  /** Replay doesn't record transit; live buses over a replayed past would mislead. */
  replayActive: boolean;
}

const SETTLE_MS = 400;

// Built by tools/transit/build-feeds.ts; read once per page.
let cities: Promise<TransitCities | null> | null = null;
const loadCities = () => (cities ??= fetch('/data/transit/cities.json').then(r => (r.ok ? r.json() : null)).catch(() => {
  cities = null;
  return null;
}));

/**
 * Zoomed out, the cities with live transit and what runs there (one static file). From TRANSIT_MIN_ZOOM,
 * live buses, trams and trains for the view: the server picks the few feeds that cover it.
 * Refreshes while zoomed in and the tab is visible.
 */
export function useTransitLayer({ mapRef, mapReady, activeLayers, replayActive }: TransitLayerArgs) {
  const on = !!activeLayers.transit && !replayActive;

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    setTransitVisible(map, on);
    if (!on) {
      setTransitData(map, []);
      return;
    }
    void loadCities().then(c => { if (c) setTransitData(map, transitCityFeatures(c), TRANSIT_CITY_SOURCE); });

    let request: AbortController | null = null;
    let settle: ReturnType<typeof setTimeout> | undefined;
    let next: ReturnType<typeof setTimeout> | undefined;
    const zoomedIn = () => map.getZoom() >= TRANSIT_MIN_ZOOM;

    const load = async () => {
      clearTimeout(next);
      request?.abort();
      if (!zoomedIn()) {
        setTransitData(map, []);
        return;
      }
      if (document.hidden) return;
      const b = map.getBounds(), c = map.getCenter();
      const view = clampView([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], [c.lng, c.lat]);
      const ctl = (request = new AbortController());
      try {
        const res = await fetch(`/api/transit?bbox=${view.join(',')}`, { signal: ctl.signal });
        if (res.ok && zoomedIn()) setTransitData(map, transitFeatures(await res.json() as TransitResponse));
      } catch {
        if (ctl.signal.aborted) return;
        // A failed poll keeps the last vehicles; the next one tries again.
      }
      if (request === ctl) next = setTimeout(load, TRANSIT_REFRESH_MS);
    };

    const onMove = () => {
      clearTimeout(settle);
      settle = setTimeout(load, SETTLE_MS);
    };
    const onVisibility = () => { if (!document.hidden) void load(); };

    map.on('moveend', onMove);
    document.addEventListener('visibilitychange', onVisibility);
    void load();
    return () => {
      map.off('moveend', onMove);
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimeout(settle);
      clearTimeout(next);
      request?.abort();
    };
  }, [mapReady, on, mapRef]);
}
