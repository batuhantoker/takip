'use client';

import { useEffect } from 'react';
import type { LayerHookArgs } from './types';

interface Cell { lat: number; lng: number; size?: number; bad: number; total: number; ratio: number }

/** Each cell drawn as the area it covers: the estimate is per cell, not per aircraft. */
export function useGnssInterferenceLayer({ mapReady, data, activeLayers, setGeo }: LayerHookArgs) {
  useEffect(() => {
    if (!mapReady) return;
    const cells: Cell[] = activeLayers.gps_jamming && Array.isArray(data.gps_jamming) ? data.gps_jamming : [];
    setGeo('gnss-interference', cells.filter(c => typeof c.ratio === 'number').map(c => {
      const h = (c.size ?? 2) / 2;
      const ring = [[c.lng - h, c.lat - h], [c.lng + h, c.lat - h], [c.lng + h, c.lat + h], [c.lng - h, c.lat + h], [c.lng - h, c.lat - h]];
      return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { bad: c.bad, total: c.total, ratio: c.ratio, lat: c.lat, lng: c.lng } };
    }));
  }, [mapReady, data.gps_jamming, activeLayers.gps_jamming, setGeo]);
}
