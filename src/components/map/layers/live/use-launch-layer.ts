'use client';

import { useEffect } from 'react';
import { padFeatures, type LaunchRow } from '@/lib/space/globe/launch-pins';
import type { LayerHookArgs } from '@/components/map/types';

export function useLaunchLayer({ mapReady, data, activeLayers, setGeo }: LayerHookArgs) {
  useEffect(() => {
    if (!mapReady) return;
    setGeo('launches', activeLayers.launches && data.launches ? padFeatures(data.launches as LaunchRow[]) : []);
  }, [mapReady, data.launches, activeLayers.launches, setGeo]);
}
