'use client';

import { useEffect } from 'react';
import type { LayerHookArgs } from './types';

interface City { city: string; lat: number; lng: number; worst: string; vendors: unknown[] }

export function useServiceStatusLayer({ mapReady, data, activeLayers, setGeo }: LayerHookArgs) {
  useEffect(() => {
    if (!mapReady) return;
    const cities: City[] = activeLayers.service_status && Array.isArray(data.service_status) ? data.service_status : [];
    setGeo('service-status', cities.map(c => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      properties: { city: c.city, worst: c.worst, count: c.vendors.length, vendors: JSON.stringify(c.vendors) },
    })));
  }, [mapReady, data.service_status, activeLayers.service_status, setGeo]);
}
