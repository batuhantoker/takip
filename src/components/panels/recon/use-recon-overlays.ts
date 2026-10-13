'use client';

import { useCallback, useState } from 'react';

/** What Recon puts on the map: the last network sweep and the ten latest geolocated scan targets. */
export function useReconOverlays() {
  const [sweepData, setSweepData] = useState<any>(null);
  const [scanTargets, setScanTargets] = useState<any[]>([]);

  const addScanTarget = useCallback((target: string, data: any) => {
    setScanTargets(prev => [{ id: target, timestamp: Date.now(), ...data }, ...prev.filter(t => t.id !== target)].slice(0, 10));
  }, []);

  return { sweepData, setSweepData, scanTargets, addScanTarget };
}
