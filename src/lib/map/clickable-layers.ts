import type * as maplibregl from 'maplibre-gl';
import { ALPR_PICK_LAYERS } from '@/lib/feeds/cameras/alpr-layers';
import { isReferenceLayerId } from '@/lib/feeds/reference/map-layers';
import { TRAFFIC_FLOW_LAYER, TRAFFIC_LAYER } from '@/lib/feeds/traffic/map-layers';

/** Layers with their own click handlers, which map-wide click handlers defer to. */
const CLICKABLE_LAYERS = new Set(['conflict-icons','cctv-dots','cctv-clusters','eq-circles','fires-heat',
  'gdelt-dots','weather-dots','infra-dots','maritime-dots','choke-dots','news-dots',
  'balloon-dots','launch-dots','rad-dots','war-alert-dots','fire-incident-dots','airport-delay-dots','chokepoint-flow-ring','outbreak-rings','ship-dots','ship-arrows','transit-dots','transit-icons','transit-city-dots','sweep-device-dots','scan-targets-dots',
  'sdk-sea','sdk-air','sdk-intel','malware-dots','cyber-heads','gdelt-events-dots',
  'cf-outage-dots','cf-attack-dots','service-status-dots','gnss-fill','fl-commercial','fl-private','fl-jets','fl-military','fl-emergency-ring','alert-pin-dots','wx-wind','wx-temp-label','history-events','history-labels','history-cells',
  'airport-wx-dots','sigmet-fill','fire-perimeter-fill','nhc-points','nhc-cone-fill',...ALPR_PICK_LAYERS,TRAFFIC_LAYER,TRAFFIC_FLOW_LAYER]);

const isClickable = (f: maplibregl.MapGeoJSONFeature) => !!f.layer?.id && (CLICKABLE_LAYERS.has(f.layer.id) || isReferenceLayerId(f.layer.id));

/**
 * Whether a marker or reference feature with its own handler is under the point.
 * Only those count: every point on the globe hits the basemap's land and water fills.
 * `slop` widens the test to a box around the point, for a finger.
 */
export function hitsClickableLayer(map: maplibregl.Map, point: maplibregl.Point, slop = 0): boolean {
  const query: maplibregl.PointLike | [maplibregl.PointLike, maplibregl.PointLike] = slop
    ? [[point.x - slop, point.y - slop], [point.x + slop, point.y + slop]]
    : point;
  return map.queryRenderedFeatures(query).some(isClickable);
}

/** The point-shaped clickable feature nearest a tap, within `slop` pixels. */
export function nearestClickable(map: maplibregl.Map, point: maplibregl.Point, slop: number): maplibregl.MapGeoJSONFeature | null {
  let best: maplibregl.MapGeoJSONFeature | null = null;
  let bestD = Infinity;
  for (const f of map.queryRenderedFeatures([[point.x - slop, point.y - slop], [point.x + slop, point.y + slop]])) {
    if (!isClickable(f) || f.geometry.type !== 'Point') continue;
    const p = map.project(f.geometry.coordinates as [number, number]);
    const d = (p.x - point.x) ** 2 + (p.y - point.y) ** 2;
    if (d < bestD) { bestD = d; best = f; }
  }
  return best;
}
