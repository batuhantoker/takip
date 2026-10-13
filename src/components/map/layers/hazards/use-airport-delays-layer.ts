'use client';

import { useEffect } from 'react';
import { airportDelayFeatures, type AirportDelayRow } from '@/lib/hazards/airport-delays';
import type { LayerHookArgs } from '@/components/map/types';

export function useAirportDelaysLayer({ mapReady, data, activeLayers, setGeo }: LayerHookArgs) {
  useEffect(() => {
    if (!mapReady) return;
    setGeo('airport-delays', activeLayers.airport_delays && data.airport_delays ? airportDelayFeatures(data.airport_delays as AirportDelayRow[]) : []);
  }, [mapReady, data.airport_delays, activeLayers.airport_delays, setGeo]);
}
