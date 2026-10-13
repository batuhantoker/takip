'use client';

import { useEffect } from 'react';
import { BASEMAP_SOURCE } from '@/lib/basemap/provider';
import { DETAIL_GROUND, DETAIL_LABELS, MILITARY_HATCH } from '@/lib/basemap/detail-layers';
import { hatchImage } from './hatch';
import type { MapRef } from './types';

const isBaseLayer = (l: { id: string; source?: unknown }) =>
  l.source === BASEMAP_SOURCE && !l.id.startsWith('detail-') && !l.id.startsWith('takip-');

/** Adds the base map detail (lib/basemap/detail-layers): ground under the base labels, labels over them and under every overlay. */
export function useBasemapDetail({ mapRef, mapReady }: { mapRef: MapRef; mapReady: boolean }) {
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    if (!map.hasImage(MILITARY_HATCH)) map.addImage(MILITARY_HATCH, hatchImage([255, 82, 82, 140]));
    const layers = map.getStyle().layers ?? [];
    const firstBaseLabel = layers.find(l => l.type === 'symbol' && isBaseLayer(l as { id: string; source?: unknown }))?.id;
    let lastBase = -1;
    layers.forEach((l, i) => { if (isBaseLayer(l as { id: string; source?: unknown })) lastBase = i; });
    const firstOverlay = layers[lastBase + 1]?.id;
    for (const layer of DETAIL_GROUND) if (!map.getLayer(layer.id)) map.addLayer(layer, firstBaseLabel);
    for (const layer of DETAIL_LABELS) if (!map.getLayer(layer.id)) map.addLayer(layer, firstOverlay);
  }, [mapRef, mapReady]);
}
