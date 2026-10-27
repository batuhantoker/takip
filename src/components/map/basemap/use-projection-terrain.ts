'use client';

import { useEffect, useRef, type RefObject } from 'react';
import * as maplibregl from 'maplibre-gl';
import { installTerrainTileProtocol } from '@/lib/map/terrain/tiles';
import { attachTerrain } from '@/lib/map/terrain/terrain';
import { applyMapProjection } from '@/lib/map/projection';
import type { MapRef, WorldMapProps } from '@/components/map/types';

interface ProjectionTerrainArgs {
  mapRef: MapRef;
  mapReady: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  projection: NonNullable<WorldMapProps['projection']>;
  terrainEnabled: boolean;
  terrainRetry: number;
  terrainFocus: number;
  onTerrainStatusChange: WorldMapProps['onTerrainStatusChange'];
}

export function useProjectionTerrain({ mapRef, mapReady, containerRef, projection, terrainEnabled, terrainRetry, terrainFocus, onTerrainStatusChange }: ProjectionTerrainArgs) {
  // Do not replay an earlier explicit zoom request after theme/retry remounts.
  const lastTerrainFocus = useRef(terrainFocus);

  // Projection changes are independent of terrain. Toggling elevation must not
  // zoom, tilt, or reposition the camera the user has already chosen.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    try {
      const projectionChanged = applyMapProjection(map, projection, terrainEnabled);
      const first = !containerRef.current?.dataset.mapProjection;
      const configureSky = projectionChanged || first;
      if (containerRef.current) containerRef.current.dataset.mapProjection = projection;
      if (projection === 'globe') {
        // The overview globe's resting tilt, which used to be the initial
        // pitch. Only on a real projection change, so toggling terrain never
        // re-tilts a camera the user has already placed. The first one is set
        // outright: it happens under the splash, which waits for the camera to stop.
        if (configureSky && map.getPitch() < 0.5) {
          if (first) map.setPitch(20);
          else map.easeTo({ pitch: 20, duration: 1200 });
        }
        try {
          if (configureSky) map.setSky({
            'sky-color': '#04040A',
            'sky-horizon-blend': 0.5,
            'horizon-color': '#0a0a1a',
            'horizon-fog-blend': 0.3,
            'fog-color': '#04040A',
            'fog-ground-blend': 0.9,
          });
        } catch (e) { console.warn('[TAKIP] Suppressed error:', e instanceof Error ? e.message : e); }
      } else {
        if (map.getPitch() > 0.5) map.easeTo({ pitch: 0, duration: 350 });
      }
    } catch (e) {
      console.warn('Projection switch failed:', e);
    }
  }, [mapReady, projection, terrainEnabled, mapRef, containerRef]);

  // Terrain loads only at regional zooms; globe overview stays inexpensive.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !terrainEnabled) return;
    const map = mapRef.current;
    installTerrainTileProtocol(maplibregl.addProtocol);
    const dispose = attachTerrain(map, status => onTerrainStatusChange?.(status));
    return () => {
      // The map constructor effect removes the entire map first on unmount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (mapRef.current === map) dispose();
    };
  }, [mapReady, terrainEnabled, terrainRetry, onTerrainStatusChange, mapRef]);

  // A user-requested close-up keeps the current location and avoids a fly-out arc.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !terrainFocus || !terrainEnabled || lastTerrainFocus.current === terrainFocus) return;
    lastTerrainFocus.current = terrainFocus;
    const map = mapRef.current;
    map.easeTo({ zoom: Math.max(10.5, map.getZoom()), pitch: 45, duration: 650 });
  }, [mapReady, terrainFocus, terrainEnabled, mapRef]);
}
