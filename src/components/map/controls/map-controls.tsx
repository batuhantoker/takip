'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { Map as MlMap } from 'maplibre-gl';
import { createMapCameraControls, type CameraMove } from '@/lib/map/camera/controls';

type Camera = {
  map: MlMap;
  step: (move: CameraMove) => void;
  press: (move: CameraMove) => void;
  release: () => void;
};

let current: Camera | null = null;
const listeners = new Set<() => void>();
const publish = (next: Camera | null) => { current = next; listeners.forEach(l => l()); };

/** The live map's camera, for the shell's control cluster; null until the map is ready. */
export function useMapCamera() {
  return useSyncExternalStore(
    l => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => current,
    () => null,
  );
}

/**
 * MapLibre opens its compact credits once, when the first source loads, and only
 * folds them on a drag; fold them that first time so they cost an icon, not the corner.
 */
function collapseCreditsOnce(map: MlMap) {
  const el = map.getContainer().querySelector('.maplibregl-ctrl-attrib');
  const fold = () => {
    if (!el?.classList.contains('maplibregl-compact-show')) return false;
    el.classList.remove('maplibregl-compact-show');
    return true;
  };
  const watch = new MutationObserver(() => { if (fold()) watch.disconnect(); });
  if (el && !fold()) watch.observe(el, { attributes: true, attributeFilter: ['class'] });
  return watch;
}

/** One step from anywhere, such as a key press; does nothing before the map exists. */
export const stepCamera = (move: CameraMove) => current?.step(move);

/**
 * Hands the map's camera to the shell. The buttons live in the shell's one
 * cluster (map-cluster.tsx) beside the projection, base map and replay,
 * which the map does not know about; replay's props are kept for world-map.
 */
export default function MapControls({ mapRef, onInteract }: {
  mapRef: React.RefObject<MlMap | null>;
  onInteract?: () => void;
  replayActive?: boolean;
  onReplayToggle?: () => void;
}) {
  const interact = useRef(onInteract);
  useEffect(() => { interact.current = onInteract; }, [onInteract]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const controls = createMapCameraControls(map, () => interact.current?.(),
      () => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const onHidden = () => { if (document.hidden) controls.release(); };
    window.addEventListener('blur', controls.release);
    document.addEventListener('visibilitychange', onHidden);
    publish({ map, step: controls.step, press: controls.press, release: controls.release });
    const credits = collapseCreditsOnce(map);
    return () => {
      credits.disconnect();
      publish(null);
      controls.dispose();
      window.removeEventListener('blur', controls.release);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [mapRef]);

  return null;
}
