'use client';

import { useEffect, useState } from 'react';
import { Minus, Navigation2, Plus } from 'lucide-react';
import { useMapCamera } from './map-controls';
import type { CameraMove } from '@/lib/map/camera-controls';
import { ClusterButton, ClusterDivider } from './cluster-button';

const ZOOM_IN: CameraMove = { kind: 'zoom', dir: 1 };
const ZOOM_OUT: CameraMove = { kind: 'zoom', dir: -1 };

/** The map's zoom limits and heading, kept in step with the camera. */
function useCameraState() {
  const camera = useMapCamera();
  const [state, setState] = useState({ min: false, max: false, bearing: 0 });
  useEffect(() => {
    const map = camera?.map;
    if (!map) return;
    const read = () => setState({
      min: map.getZoom() <= map.getMinZoom() + 0.001,
      max: map.getZoom() >= map.getMaxZoom() - 0.001,
      bearing: map.getBearing(),
    });
    read();
    map.on('zoomend', read);
    map.on('rotate', read);
    return () => { map.off('zoomend', read); map.off('rotate', read); };
  }, [camera]);
  return { camera, ...state };
}

/** Zoom in and out (hold to keep going), and a compass that appears once the map is turned. */
export function CameraButtons({ touch }: { touch: boolean }) {
  const { camera, min, max, bearing } = useCameraState();
  const turned = Math.abs(bearing) > 0.5;
  const hold = (move: CameraMove) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0 || !camera) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      camera.press(move);
    },
    onPointerUp: () => camera?.release(),
    onPointerCancel: () => camera?.release(),
    onLostPointerCapture: () => camera?.release(),
    // Keyboard presses arrive as clicks with no pointer behind them.
    onClick: (e: React.MouseEvent) => { if (e.detail === 0) camera?.step(move); },
  });

  return (
    <>
      {turned && (
        <>
          <ClusterButton label="Point north" touch={touch} onClick={() => camera?.map.easeTo({ bearing: 0, duration: 300 })}>
            <Navigation2 aria-hidden className="size-4 fill-red/80 text-red transition-transform duration-150" strokeWidth={1.5}
              style={{ transform: `rotate(${-bearing}deg)` }} />
          </ClusterButton>
          <ClusterDivider />
        </>
      )}
      <div data-map-controls className="flex flex-col">
        <ClusterButton label="Zoom in" kbd="+" touch={touch} disabled={!camera || max} className="touch-none" {...hold(ZOOM_IN)}>
          <Plus aria-hidden className="size-4" strokeWidth={1.75} />
        </ClusterButton>
        <ClusterButton label="Zoom out" kbd="−" touch={touch} disabled={!camera || min} className="touch-none" {...hold(ZOOM_OUT)}>
          <Minus aria-hidden className="size-4" strokeWidth={1.75} />
        </ClusterButton>
      </div>
    </>
  );
}
