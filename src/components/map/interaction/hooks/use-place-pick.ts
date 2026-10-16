'use client';

import { useEffect, type RefObject } from 'react';
import type * as maplibregl from 'maplibre-gl';
import type { AiGlobe } from '@/lib/ai/globe/attach';
import { touchSlop } from '@/lib/map/touch-targets';
import { hitsClickableLayer } from '@/lib/map/clickable-layers';
import { attachPlacePick } from '@/components/map/interaction/place-pick';
import type { MapRef, WorldMapProps } from '@/components/map/types';

interface PlacePickArgs {
  mapRef: MapRef;
  mapReady: boolean;
  popupRef: RefObject<maplibregl.Popup | null>;
  drawModeRef: RefObject<WorldMapProps['drawMode']>;
  aiGlobeRef: RefObject<AiGlobe | null>;
  satPickedRef: RefObject<number | null>;
}

/** Click a place name for its Wikipedia lead; see ./place-pick. */
export function usePlacePick({ mapRef, mapReady, popupRef, drawModeRef, aiGlobeRef, satPickedRef }: PlacePickArgs) {
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const pick = attachPlacePick(map, {
      popupRef,
      // Bound after bindSatellitePick, whose handler has already run for this click and set satPickedRef.
      claimed: e => drawModeRef.current != null || hitsClickableLayer(map, e.point, touchSlop(e)) || !!aiGlobeRef.current?.hit(e.point) || satPickedRef.current != null,
    });
    return () => pick.destroy();
  }, [mapRef, mapReady, popupRef, drawModeRef, aiGlobeRef, satPickedRef]);
}
