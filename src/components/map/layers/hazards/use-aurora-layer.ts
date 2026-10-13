'use client';

import { useEffect } from 'react';
import type { LayerHookArgs } from '@/components/map/types';

export function useAuroraLayer({ mapReady, data, activeLayers, setGeo }: LayerHookArgs) {
  useEffect(() => {
    if (!mapReady) return;
    const cells: [number, number, number][] = activeLayers.aurora && Array.isArray(data.aurora?.cells) ? data.aurora.cells : [];
    setGeo('aurora', cells.map(([lng, lat, p]) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: { p } })));
  }, [mapReady, data.aurora, activeLayers.aurora, setGeo]);
}
