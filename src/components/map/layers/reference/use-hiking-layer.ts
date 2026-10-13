'use client';

import { useEffect, useRef, type RefObject } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { HIKING_ATTRIBUTION, HIKING_LAYER, HIKING_MAX_ZOOM, HIKING_TILES } from '@/lib/hiking/overlay';
import type { OiGlobe } from '@/lib/oi/globe';
import { touchSlop } from '@/lib/map/touch-targets';
import { hitsClickableLayer } from '@/lib/map/clickable-layers';
import { attachHikingPick, type HikingPick } from './hiking-pick';
import { stackGroundRasters } from '@/lib/basemap/ground-rasters';
import type { MapRef, WorldMapProps } from '@/components/map/types';

interface HikingLayerArgs {
  mapRef: MapRef;
  mapReady: boolean;
  activeLayers: WorldMapProps['activeLayers'];
  mapStyle: string;
}

/** Waymarked Trails' hiking routes (lib/hiking/overlay), on the ground under the weather. */
export function useHikingLayer({ mapRef, mapReady, activeLayers, mapStyle }: HikingLayerArgs) {
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    // The source stays when switched off, so its cached tiles are reused.
    if (!activeLayers.hiking_routes) {
      if (map.getLayer(HIKING_LAYER)) map.removeLayer(HIKING_LAYER);
      return;
    }
    if (!map.getSource(HIKING_LAYER)) {
      map.addSource(HIKING_LAYER, { type: 'raster', tiles: [HIKING_TILES], tileSize: 256, maxzoom: HIKING_MAX_ZOOM, attribution: HIKING_ATTRIBUTION });
    }
    if (!map.getLayer(HIKING_LAYER)) {
      map.addLayer({ id: HIKING_LAYER, type: 'raster', source: HIKING_LAYER }, 'day-night-fill');
    }
    stackGroundRasters(map);
  }, [mapReady, activeLayers.hiking_routes, mapStyle, mapRef]);
}

interface HikingPickArgs {
  mapRef: MapRef;
  mapReady: boolean;
  activeLayers: WorldMapProps['activeLayers'];
  popupRef: RefObject<maplibregl.Popup | null>;
  drawModeRef: RefObject<WorldMapProps['drawMode']>;
  oiGlobeRef: RefObject<OiGlobe | null>;
  satPickedRef: RefObject<number | null>;
}

/** Click a trail for its details and a highlight; see ./hiking-pick. */
export function useHikingPick({ mapRef, mapReady, activeLayers, popupRef, drawModeRef, oiGlobeRef, satPickedRef }: HikingPickArgs) {
  const pick = useRef<HikingPick | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const attached = attachHikingPick(map, {
      popupRef,
      // Bound after bindSatellitePick, whose handler has already run for this click and set satPickedRef.
      claimed: e => drawModeRef.current != null || hitsClickableLayer(map, e.point, touchSlop(e)) || !!oiGlobeRef.current?.hit(e.point) || satPickedRef.current != null,
    });
    pick.current = attached;
    return () => {
      attached.destroy();
      pick.current = null;
    };
  }, [mapRef, mapReady, popupRef, drawModeRef, oiGlobeRef, satPickedRef]);

  useEffect(() => {
    if (mapReady) pick.current?.setActive(!!activeLayers.hiking_routes);
  }, [mapReady, activeLayers.hiking_routes]);
}
