'use client';

import { useEffect } from 'react';
import { chokepointFlowFeatures, type ChokepointDisruptionRow, type ChokepointFlowRow } from '@/lib/feeds/maritime/chokepoint-flow';
import type { LayerHookArgs } from '@/components/map/types';

export function useChokepointFlowLayer({ mapReady, data, activeLayers, setGeo }: LayerHookArgs) {
  useEffect(() => {
    if (!mapReady) return;
    setGeo('chokepoint-flow', activeLayers.chokepoint_flow && data.chokepoint_flow
      ? chokepointFlowFeatures(data.chokepoint_flow as ChokepointFlowRow[], (data.chokepoint_disruptions ?? []) as ChokepointDisruptionRow[])
      : []);
  }, [mapReady, data.chokepoint_flow, data.chokepoint_disruptions, activeLayers.chokepoint_flow, setGeo]);
}
