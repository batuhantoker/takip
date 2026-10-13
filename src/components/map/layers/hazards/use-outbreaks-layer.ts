'use client';

import { useEffect } from 'react';
import { outbreakFeatures, type OutbreakRow } from '@/lib/hazards/outbreaks';
import type { LayerHookArgs } from '@/components/map/types';

export function useOutbreaksLayer({ mapReady, data, activeLayers, setGeo }: LayerHookArgs) {
  useEffect(() => {
    if (!mapReady) return;
    setGeo('outbreaks', activeLayers.outbreaks && data.outbreaks ? outbreakFeatures(data.outbreaks as OutbreakRow[]) : []);
  }, [mapReady, data.outbreaks, activeLayers.outbreaks, setGeo]);
}
