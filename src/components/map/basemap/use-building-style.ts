'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { BUILDING_DEFAULTS, BUILDINGS_LAYER, buildingColor, getBuildingStyle, readAccent, subscribeBuildingStyle } from '@/lib/map/basemap/buildings';
import { STYLE_EVENT } from '@/lib/map/style/style-studio';
import type { MapRef } from '@/components/map/types';

export const useBuildingStyle = () => useSyncExternalStore(subscribeBuildingStyle, getBuildingStyle, () => BUILDING_DEFAULTS);

/** Repaints the 3D buildings when their look changes, or the Style studio changes the accent they can follow. */
export function useBuildingPaint({ mapRef, mapReady, on }: { mapRef: MapRef; mapReady: boolean; on: boolean }) {
  const style = useBuildingStyle();
  // Read when painting, not at mount: a theme switch remounts the map before its class lands on <body>.
  const [studioEdits, setStudioEdits] = useState(0);
  useEffect(() => {
    const bump = () => setStudioEdits(n => n + 1);
    window.addEventListener(STYLE_EVENT, bump);
    return () => window.removeEventListener(STYLE_EVENT, bump);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !on || !map?.getLayer(BUILDINGS_LAYER)) return;
    map.setPaintProperty(BUILDINGS_LAYER, 'fill-extrusion-color', buildingColor(style.look, readAccent()));
    map.setPaintProperty(BUILDINGS_LAYER, 'fill-extrusion-opacity', style.opacity);
  }, [mapRef, mapReady, on, style, studioEdits]);
}
