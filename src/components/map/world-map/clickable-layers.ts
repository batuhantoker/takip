import type * as maplibregl from 'maplibre-gl';
import { isReferenceLayerId } from '@/lib/reference/map-layers';

/** Layers with their own click handlers, which map-wide click handlers defer to. */
const CLICKABLE_LAYERS = new Set(['conflict-icons','cctv-dots','eq-circles','fires-heat',
  'gdelt-dots','weather-dots','infra-dots','maritime-dots','choke-dots','news-dots',
  'balloon-dots','launch-dots','rad-dots','war-alert-dots','fire-incident-dots','airport-delay-dots','chokepoint-flow-ring','outbreak-rings','ship-dots','ship-arrows','sweep-device-dots','scan-targets-dots',
  'sdk-sea','sdk-air','sdk-intel','malware-dots','cyber-heads','gdelt-events-dots',
  'cf-outage-dots','cf-attack-dots','service-status-dots','gnss-fill','fl-commercial','fl-private','fl-jets','fl-military','alert-pin-dots','wx-wind','wx-temp-label','history-events','history-cells']);

/**
 * Whether a marker or reference feature with its own handler is under the point.
 * Only those count: every point on the globe hits the basemap's land and water fills.
 */
export function hitsClickableLayer(map: maplibregl.Map, point: maplibregl.PointLike): boolean {
  return map.queryRenderedFeatures(point).some(f => f.layer?.id && (CLICKABLE_LAYERS.has(f.layer.id) || isReferenceLayerId(f.layer.id)));
}
