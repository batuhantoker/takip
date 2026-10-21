import type * as maplibregl from 'maplibre-gl';
import { LABEL_SIZE, MAP_INK, labelPaint } from '@/lib/map/style/tokens';

/** Must stay below the zoom where CctvPreviews starts reading raw `cctv-dots` (13). */
const CLUSTER_MAX_ZOOM = 12;

export const CCTV_CLUSTER_LAYERS = ['cctv-clusters', 'cctv-cluster-count'];
/** The cameras in view up close, with their names: the pins carry none (pins.ts). */
export const CCTV_NAMED_SOURCE = 'cctv-named';
export const CCTV_LABEL_MIN_ZOOM = 15;
export const CCTV_LAYERS = [...CCTV_CLUSTER_LAYERS, 'cctv-dots', 'cctv-label'];

export function addCctvSource(map: maplibregl.Map) {
  map.addSource('cctv', {
    type: 'geojson', data: { type: 'FeatureCollection', features: [] },
    // Groups under six stay as dots: a field of "3" and "4" bubbles is louder than the dots it replaces.
    cluster: true, clusterMaxZoom: CLUSTER_MAX_ZOOM, clusterRadius: 52, clusterMinPoints: 6,
  });
  map.addSource(CCTV_NAMED_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
}

export function addCctvLayers(map: maplibregl.Map, color: string) {
  map.addLayer({ id: 'cctv-clusters', type: 'circle', source: 'cctv', filter: ['has', 'point_count'], paint: {
    'circle-radius': ['step', ['get', 'point_count'], 9, 50, 11, 250, 13, 1000, 15],
    'circle-color': MAP_INK.surface1,
    'circle-opacity': 0.88,
    'circle-stroke-width': 1,
    'circle-stroke-color': color,
    'circle-stroke-opacity': 0.55,
  }});
  map.addLayer({ id: 'cctv-cluster-count', type: 'symbol', source: 'cctv', filter: ['has', 'point_count'], layout: {
    'text-field': ['get', 'point_count_abbreviated'],
    'text-font': ['Noto Sans Bold'],
    'text-size': LABEL_SIZE,
    'text-allow-overlap': true,
    'text-ignore-placement': true,
  }, paint: { 'text-color': MAP_INK.ink1 }});
  map.addLayer({ id: 'cctv-dots', type: 'circle', source: 'cctv', filter: ['!', ['has', 'point_count']], paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.5, 10, 3.5, 14, 5, 17, 6.5],
    'circle-color': color,
    // Off-air cameras keep their pin, faded. Opacity, because use-map-palette rewrites circle-color.
    'circle-opacity': ['case', ['==', ['get', 'offline'], true], 0.35, 0.9],
    'circle-stroke-width': 1,
    'circle-stroke-color': MAP_INK.surface0,
    'circle-stroke-opacity': ['case', ['==', ['get', 'offline'], true], 0.4, 0.85],
  }});
  map.addLayer({ id: 'cctv-label', type: 'symbol', source: CCTV_NAMED_SOURCE, minzoom: CCTV_LABEL_MIN_ZOOM, layout: {
    'text-field': ['get', 'name'], 'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-max-width': 12, 'text-allow-overlap': false,
  }, paint: labelPaint() });
}

/** A click on a count bubble opens it: zoom to where the cluster splits. */
export function bindCctvClusterClicks(map: maplibregl.Map) {
  map.on('click', 'cctv-clusters', async e => {
    const f = e.features?.[0];
    if (!f || f.geometry.type !== 'Point') return;
    const src = map.getSource('cctv') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    try {
      const zoom = await src.getClusterExpansionZoom(f.properties?.cluster_id);
      map.easeTo({ center: f.geometry.coordinates as [number, number], zoom: Math.min(zoom + 0.25, 16), duration: 450 });
    } catch { /* cluster gone after a data refresh */ }
  });
}
