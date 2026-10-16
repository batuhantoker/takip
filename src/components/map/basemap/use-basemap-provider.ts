'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { BASEMAP_SOURCE, getBasemapProvider, subscribeBasemapProvider, tilejsonFor } from '@/lib/map/basemap/provider';
import type { MapRef } from '@/components/map/types';

export const useBasemapProvider = () => useSyncExternalStore(subscribeBasemapProvider, getBasemapProvider, () => 'openfreemap' as const);

/** Points the style's vector source at the chosen provider; layers and overlays stay put. */
export function useBasemapProviderSource({ mapRef, mapReady }: { mapRef: MapRef; mapReady: boolean }) {
  const provider = useBasemapProvider();
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const source = map.getSource(BASEMAP_SOURCE) as maplibregl.VectorTileSource | undefined;
    const url = tilejsonFor(provider);
    if (source && source.url !== url) source.setUrl(url);
  }, [mapRef, mapReady, provider]);
}
