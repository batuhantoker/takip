'use client';

import { useEffect } from 'react';
import { warAlertFeatures, type WarAlertRow } from '@/lib/war-alerts';
import type { LayerHookArgs } from './types';

export function useWarAlertsLayer({ mapReady, data, activeLayers, setGeo }: LayerHookArgs) {
  useEffect(() => {
    if (!mapReady) return;
    setGeo('war-alerts-targets', activeLayers.war_alerts && data.war_alerts ? warAlertFeatures(data.war_alerts as WarAlertRow[]) : []);
  }, [mapReady, data.war_alerts, activeLayers.war_alerts, setGeo]);
}
