import type * as maplibregl from 'maplibre-gl';
import { HIKING_LAYER } from '@/lib/hiking/overlay';
import { CLOUDS_LAYER } from '@/lib/weather/live-clouds';

/** Trails, then temperature, clouds and radar, all under the place names (Topo's are baked in, so over Topo). */
export function stackGroundRasters(map: maplibregl.Map) {
  const topo = map.getLayer('topo-layer') && map.getLayoutProperty('topo-layer', 'visibility') !== 'none';
  const firstLabel = map.getStyle().layers.find(layer => layer.type === 'symbol')?.id;
  const anchor = topo || !firstLabel ? 'day-night-fill' : firstLabel;
  for (const id of [HIKING_LAYER, 'wx-field', CLOUDS_LAYER, 'wx-radar']) {
    if (map.getLayer(id)) map.moveLayer(id, anchor);
  }
}
