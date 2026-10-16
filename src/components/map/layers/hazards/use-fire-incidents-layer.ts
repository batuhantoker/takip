'use client';

import { useEffect } from 'react';
import { fireIncidentFeatures, type FireIncidentRow } from '@/lib/feeds/hazards/fire-incidents';
import type { LayerHookArgs } from '@/components/map/types';

export function useFireIncidentsLayer({ mapReady, data, activeLayers, setGeo }: LayerHookArgs) {
  useEffect(() => {
    if (!mapReady) return;
    setGeo('fire-incidents', activeLayers.fires && data.fire_incidents ? fireIncidentFeatures(data.fire_incidents as FireIncidentRow[]) : []);
  }, [mapReady, data.fire_incidents, activeLayers.fires, setGeo]);
}
