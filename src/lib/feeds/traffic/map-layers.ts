import type * as maplibregl from 'maplibre-gl';
import { BASEMAP_SOURCE } from '@/lib/map/basemap/provider';
import { MAP_INK } from '@/lib/map/style/tokens';
import { FLOW_JAM, FLOW_MAX_ZOOM, FLOW_SLOW, FLOW_SOURCE_LAYER } from './sources/tomtom';
import { TRAFFIC_MIN_ZOOM, TRAFFIC_REFRESH_MS, type TrafficLevel, type TrafficResponse } from './types';

export const TRAFFIC_SOURCE = 'traffic';
export const TRAFFIC_LAYER = 'traffic-tint';
export const TRAFFIC_FLOW_SOURCE = 'traffic-flow';
export const TRAFFIC_FLOW_LAYER = 'traffic-flow-tint';
export const TRAFFIC_COLOR: Record<TrafficLevel, string> = { slow: MAP_INK.amber, jam: MAP_INK.red };
export const TRAFFIC_ATTRIBUTION = 'Traffic: <a href="https://opendata.ndw.nu/" target="_blank" rel="noopener">NDW</a> · Rennes Métropole · Nantes Métropole';
export const TRAFFIC_FLOW_ATTRIBUTION = 'Traffic: <a href="https://www.tomtom.com/" target="_blank" rel="noopener">TomTom</a>';

type Expr = maplibregl.ExpressionSpecification;

const EMPTY = { type: 'FeatureCollection' as const, features: [] };
const byZoom = (far: number, mid: number, near: number): Expr =>
  ['interpolate', ['exponential', 1.5], ['zoom'], TRAFFIC_MIN_ZOOM, far, 14, mid, 17, near];

/** `level` gives 'slow' or 'jam'; `side` is 1, -1 or 0 for which side of the line the tint sits. */
const tintPaint = (level: Expr, side: Expr): maplibregl.LineLayerSpecification['paint'] => ({
  'line-color': ['match', level, 'jam', TRAFFIC_COLOR.jam, TRAFFIC_COLOR.slow],
  'line-opacity': ['match', level, 'jam', 0.62, 0.42],
  'line-width': byZoom(2.2, 5, 10),
  // Lines drawn in the direction of travel sit on the right, so the two directions of a road part.
  'line-offset': ['interpolate', ['exponential', 1.5], ['zoom'],
    TRAFFIC_MIN_ZOOM, ['*', side, 0.8], 14, ['*', side, 2.5], 17, ['*', side, 5.5]],
  'line-blur': 0.6,
});

const flowRatio: Expr = ['to-number', ['get', 'traffic_level'], 1];
const flowClosed: Expr = ['==', ['get', 'road_closure'], true];

/** TomTom flow tiles change every refresh period; the stamp makes the browser fetch the new ones. */
const flowTilesUrl = (now = Date.now()) => `${location.origin}/api/traffic/flow/{z}/{x}/{y}?t=${Math.floor(now / TRAFFIC_REFRESH_MS)}`;

/** A faint tint over the road it measures: above the base map's roads, under its names. */
export function addTrafficLayers(map: maplibregl.Map) {
  map.addSource(TRAFFIC_SOURCE, { type: 'geojson', data: EMPTY, attribution: TRAFFIC_ATTRIBUTION });
  map.addSource(TRAFFIC_FLOW_SOURCE, {
    type: 'vector', tiles: [flowTilesUrl()], minzoom: TRAFFIC_MIN_ZOOM, maxzoom: FLOW_MAX_ZOOM, attribution: TRAFFIC_FLOW_ATTRIBUTION,
  });
  const firstLabel = map.getStyle().layers.find(l => l.type === 'symbol' && 'source' in l && l.source === BASEMAP_SOURCE)?.id;
  // Under the open feeds' tint, which wins where both measure a road.
  map.addLayer({
    id: TRAFFIC_FLOW_LAYER, type: 'line', source: TRAFFIC_FLOW_SOURCE, 'source-layer': FLOW_SOURCE_LAYER, minzoom: TRAFFIC_MIN_ZOOM,
    filter: ['any', flowClosed, ['<', flowRatio, FLOW_SLOW]],
    layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
    paint: tintPaint(
      ['case', flowClosed, 'jam', ['<', flowRatio, FLOW_JAM], 'jam', 'slow'],
      ['case', ['!=', ['get', 'traffic_road_coverage'], 'one_side'], 0, ['==', ['get', 'left_hand_traffic'], true], -1, 1],
    ),
  }, firstLabel);
  map.addLayer({
    id: TRAFFIC_LAYER, type: 'line', source: TRAFFIC_SOURCE, minzoom: TRAFFIC_MIN_ZOOM,
    layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
    paint: tintPaint(['get', 'level'], ['get', 'side']),
  }, firstLabel);
}

export function setTrafficVisible(map: maplibregl.Map, on: boolean) {
  if (map.getLayer(TRAFFIC_LAYER)) map.setLayoutProperty(TRAFFIC_LAYER, 'visibility', on ? 'visible' : 'none');
}

/** Hidden, the flow source requests no tiles. */
export function setTrafficFlowVisible(map: maplibregl.Map, on: boolean) {
  if (map.getLayer(TRAFFIC_FLOW_LAYER)) map.setLayoutProperty(TRAFFIC_FLOW_LAYER, 'visibility', on ? 'visible' : 'none');
}

/** Swaps in the current period's tiles; within a period it leaves the drawn ones alone. */
export function refreshTrafficFlow(map: maplibregl.Map) {
  const src = map.getSource<maplibregl.VectorTileSource>(TRAFFIC_FLOW_SOURCE);
  const url = flowTilesUrl();
  if (src && src.tiles?.[0] !== url) src.setTiles([url]);
}

export function setTrafficData(map: maplibregl.Map, features: GeoJSON.Feature[]) {
  (map.getSource(TRAFFIC_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
}

export function trafficFeatures(res: TrafficResponse): GeoJSON.Feature<GeoJSON.LineString>[] {
  return res.segments.map(({ coords, ...s }) => ({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
    // Only NDW's lines are known to run in the direction of travel.
    properties: { ...s, side: s.source === 'ndw' ? 1 : 0 },
  }));
}
