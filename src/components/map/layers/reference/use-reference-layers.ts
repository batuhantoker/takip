'use client';

import { useEffect, useRef } from 'react';
import { attachReferenceLayers, type ReferenceLayers } from '@/lib/reference/map-layers';
import type { LayerHookArgs } from '@/components/map/types';

/** The reference datasets (lib/reference), attached once the style has loaded and kept in step with the toggles. */
export function useReferenceLayers({ mapRef, mapReady, activeLayers }: LayerHookArgs) {
  const layers = useRef<ReferenceLayers | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    // Under the first live point layer, so aircraft, ships and cameras stay on top.
    const attached = attachReferenceLayers(map, { beforeId: 'eq-circles' });
    layers.current = attached;
    return () => {
      attached.destroy();
      layers.current = null;
    };
  }, [mapRef, mapReady]);

  useEffect(() => {
    if (mapReady) layers.current?.update(activeLayers);
  }, [mapReady, activeLayers]);
}
