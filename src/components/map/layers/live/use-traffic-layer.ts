'use client';

import { useEffect } from 'react';
import { refreshTrafficFlow, setTrafficData, setTrafficFlowVisible, setTrafficVisible, trafficFeatures } from '@/lib/feeds/traffic/map-layers';
import { clampView, TRAFFIC_MIN_ZOOM, TRAFFIC_REFRESH_MS, type TrafficResponse } from '@/lib/feeds/traffic/types';
import type { MapRef, WorldMapProps } from '@/components/map/types';

interface TrafficLayerArgs {
  mapRef: MapRef;
  mapReady: boolean;
  activeLayers: WorldMapProps['activeLayers'];
  /** Nothing is recorded; today's traffic over a replayed past would mislead. */
  replayActive: boolean;
}

const SETTLE_MS = 400;

/** Measured road speeds for the view from TRAFFIC_MIN_ZOOM (open feeds, and TomTom tiles when keyed), refreshed while the tab is visible. */
export function useTrafficLayer({ mapRef, mapReady, activeLayers, replayActive }: TrafficLayerArgs) {
  const on = !!activeLayers.traffic && !replayActive;

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    setTrafficVisible(map, on);
    if (!on) {
      setTrafficFlowVisible(map, false);
      setTrafficData(map, []);
      return;
    }

    let request: AbortController | null = null;
    let settle: ReturnType<typeof setTimeout> | undefined;
    let next: ReturnType<typeof setTimeout> | undefined;
    const zoomedIn = () => map.getZoom() >= TRAFFIC_MIN_ZOOM;

    const load = async () => {
      clearTimeout(next);
      request?.abort();
      if (!zoomedIn()) {
        setTrafficData(map, []);
        return;
      }
      if (document.hidden) return;
      const b = map.getBounds(), c = map.getCenter();
      const view = clampView([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], [c.lng, c.lat]);
      const ctl = (request = new AbortController());
      try {
        const res = await fetch(`/api/traffic?bbox=${view.join(',')}`, { signal: ctl.signal });
        if (res.ok && zoomedIn()) {
          const body = await res.json() as TrafficResponse;
          setTrafficData(map, trafficFeatures(body));
          setTrafficFlowVisible(map, body.flow);
          if (body.flow) refreshTrafficFlow(map);
        }
      } catch {
        if (ctl.signal.aborted) return;
        // A failed poll keeps what is drawn; the next one tries again.
      }
      if (request === ctl) next = setTimeout(load, TRAFFIC_REFRESH_MS);
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
