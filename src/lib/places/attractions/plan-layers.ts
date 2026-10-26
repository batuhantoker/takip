import type * as maplibregl from 'maplibre-gl';
import type { Locale } from '@/lib/core/i18n/locales';
import { LABEL_SIZE, MAP_INK, labelPaint } from '@/lib/map/style/tokens';

/** A place page's day plan on its live map, from /api/things-to-do/plan: a line per day, its stops numbered. */

const SOURCE = 'day-plan';
export const PLAN_STOPS = 'day-plan-stops';
const LAYERS = ['day-plan-trip', 'day-plan-walk', PLAN_STOPS, 'day-plan-numbers', 'day-plan-names'];

/** Day 1 to 7, in the map's quieter tones. */
export const DAY_INK = [MAP_INK.teal, MAP_INK.rose, MAP_INK.sand, MAP_INK.green, MAP_INK.blue, MAP_INK.violet, MAP_INK.amber];

const dayColor = ['match', ['get', 'day'], ...DAY_INK.flatMap((c, i) => [i + 1, c]), MAP_INK.ink2] as unknown as maplibregl.ExpressionSpecification;

export const planUrl = (plan: string, locale: Locale) => {
  const [place, slug] = plan.split(':');
  return `/api/things-to-do/plan?place=${place}&slug=${encodeURIComponent(slug)}&lang=${locale}`;
};

export function drawPlan(map: maplibregl.Map, data: GeoJSON.FeatureCollection) {
  const source = map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined;
  if (source) {
    source.setData(data);
    return;
  }
  map.addSource(SOURCE, { type: 'geojson', data });
  const add = (layer: maplibregl.LayerSpecification) => map.addLayer(layer);
  add({ id: 'day-plan-trip', type: 'line', source: SOURCE, filter: ['==', ['get', 'kind'], 'trip'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': MAP_INK.ink3, 'line-width': 1.5, 'line-dasharray': [2, 2] } });
  add({ id: 'day-plan-walk', type: 'line', source: SOURCE, filter: ['==', ['get', 'kind'], 'walk'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': dayColor, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.5, 12, 3, 16, 4.5], 'line-opacity': 0.9 } });
  add({ id: PLAN_STOPS, type: 'circle', source: SOURCE, filter: ['==', ['get', 'kind'], 'stop'],
    paint: {
      'circle-color': dayColor, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 3, 11, 8, 15, 10],
      'circle-stroke-width': 1.5, 'circle-stroke-color': MAP_INK.surface0,
    } });
  add({ id: 'day-plan-numbers', type: 'symbol', source: SOURCE, filter: ['==', ['get', 'kind'], 'stop'], minzoom: 10,
    layout: {
      'text-field': ['to-string', ['get', 'n']], 'text-font': ['Noto Sans Bold'], 'text-size': 10,
      'text-allow-overlap': true, 'text-ignore-placement': true,
    },
    paint: { 'text-color': MAP_INK.surface0 } });
  add({ id: 'day-plan-names', type: 'symbol', source: SOURCE, filter: ['==', ['get', 'kind'], 'stop'], minzoom: 11,
    layout: {
      'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': LABEL_SIZE,
      'text-variable-anchor': ['left', 'right', 'top', 'bottom'], 'text-radial-offset': 1.1, 'text-justify': 'auto',
      'text-max-width': 10, 'text-optional': true,
    },
    paint: labelPaint(MAP_INK.ink1) });
}

export function clearPlan(map: maplibregl.Map) {
  for (const id of LAYERS) if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(SOURCE)) map.removeSource(SOURCE);
}
