'use client';

import { useEffect, useState } from 'react';
import { useMapCamera } from './map-controls';
import type { MapView } from '@/components/shell/state/types';

/** The camera's zoom and latitude while it moves, at most once a frame; `settled` until the map exists. */
export function useLiveView(settled: MapView): MapView {
  const camera = useMapCamera();
  const [live, setLive] = useState<MapView | null>(null);

  useEffect(() => {
    const map = camera?.map;
    if (!map) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      setLive({ zoom: map.getZoom(), latitude: map.getCenter().lat });
    };
    const onMove = () => { if (!frame) frame = requestAnimationFrame(read); };
    read();
    map.on('move', onMove);
    return () => { map.off('move', onMove); cancelAnimationFrame(frame); };
  }, [camera]);

  return live ?? settled;
}
