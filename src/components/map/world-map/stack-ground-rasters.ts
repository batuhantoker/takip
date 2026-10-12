import type * as maplibregl from 'maplibre-gl';
import { HIKING_LAYER } from '@/lib/hiking/overlay';
import { CLOUDS_LAYER } from '@/lib/live-clouds';

/** Trails, then temperature, clouds and radar, all under the place names (above the imagery on SAT). */
export function stackGroundRasters(map: maplibregl.Map) {
  const satellite = map.getLayer('satellite-layer') && map.getLayoutProperty('satellite-layer', 'visibility') !== 'none';
  const firstLabel = map.getStyle().layers.find(layer => layer.type === 'symbol')?.id;
  const anchor = satellite || !firstLabel ? 'day-night-fill' : firstLabel;
  for (const id of [HIKING_LAYER, 'wx-field', CLOUDS_LAYER, 'wx-radar']) {
    if (map.getLayer(id)) map.moveLayer(id, anchor);
  }
}
