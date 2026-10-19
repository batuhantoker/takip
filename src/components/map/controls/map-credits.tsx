'use client';

import { useEffect, useRef } from 'react';
import type { AttributionControl } from 'maplibre-gl';
import type { Corner } from '@/components/shell/layout/lib/model';
import { MAP_CREDITS } from '@/lib/map/credits';
import { useMapCamera } from './map-controls';

/**
 * MapLibre opens its compact credits once, when the first source loads, and only
 * folds them on a drag; fold them that first time so they cost an icon, not the corner.
 */
function foldOnce(el: HTMLElement) {
  const fold = () => {
    if (!el.classList.contains('maplibregl-compact-show')) return false;
    el.classList.remove('maplibregl-compact-show');
    return true;
  };
  const watch = new MutationObserver(() => { if (fold()) watch.disconnect(); });
  if (!fold()) watch.observe(el, { attributes: true, attributeFilter: ['class'] });
  return watch;
}

/**
 * The map's credits, on by design (issue #16): MapLibre's own control, so they follow the sources on the map, mounted
 * beside the map controls rather than in a map corner, so they go wherever the person puts those. The box keeps a
 * 24 px place; opened, the credits spread over the map from the corner side (globals.css, .map-credits).
 */
export default function MapCredits({ corner }: { corner: Corner }) {
  const map = useMapCamera()?.map;
  const host = useRef<HTMLDivElement>(null);

  // The map is rebuilt on a theme change, so the control is too.
  useEffect(() => {
    if (!map) return;
    let control: AttributionControl | null = null;
    let watch: MutationObserver | null = null;
    let live = true;
    void import('maplibre-gl').then(({ AttributionControl }) => {
      if (!live || !host.current) return;
      control = new AttributionControl({ compact: true, customAttribution: MAP_CREDITS });
      const el = control.onAdd(map);
      host.current.appendChild(el);
      watch = foldOnce(el);
    });
    return () => {
      live = false;
      watch?.disconnect();
      control?.onRemove();
    };
  }, [map]);

  return <div ref={host} className={`map-credits maplibregl-ctrl-${corner}`} />;
}
