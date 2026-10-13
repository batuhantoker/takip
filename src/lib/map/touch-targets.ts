import type * as maplibregl from 'maplibre-gl';
import { hitsClickableLayer, nearestClickable } from './clickable-layers';

/** Pixels of room a finger gets around a marker. */
const TOUCH_SLOP = 16;

/** Taps get room for a finger; a mouse needs none. */
export function touchSlop(e: { originalEvent?: unknown }): number {
  const oe = e.originalEvent as { pointerType?: string } | undefined;
  if (oe?.pointerType) return oe.pointerType === 'touch' ? TOUCH_SLOP : 0;
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches ? TOUCH_SLOP : 0;
}

/**
 * A tap that lands just beside a marker is re-sent to the marker itself, so every
 * layer's own click handler serves fingers without knowing about them.
 */
export function bindTouchTargets(map: maplibregl.Map) {
  let resending = false;
  const onClick = (e: maplibregl.MapMouseEvent) => {
    const slop = touchSlop(e);
    if (resending || !slop || hitsClickableLayer(map, e.point)) return;
    const f = nearestClickable(map, e.point, slop);
    if (!f || f.geometry.type !== 'Point') return;
    const point = map.project(f.geometry.coordinates as [number, number]);
    resending = true;
    try { map.fire('click', { point, lngLat: map.unproject(point), originalEvent: e.originalEvent }); } finally { resending = false; }
  };
  map.on('click', onClick);
  return () => { map.off('click', onClick); };
}
