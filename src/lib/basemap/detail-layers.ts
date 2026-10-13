/**
 * Detail drawn from what the base map's OpenMapTiles tiles already carry but the
 * Dark Matter style leaves out: military land, ice and rock, rail and ferries,
 * peaks, airfields, protected-area names and key places of interest.
 */
import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import { BASEMAP_SOURCE } from './provider';

export const MILITARY_HATCH = 'detail-military-hatch';

const NAME: ExpressionSpecification = ['coalesce', ['get', 'name_en'], ['get', 'name']];
const HALO = { 'text-halo-color': '#0e0e0e', 'text-halo-width': 1.2 } as const;
const src = { source: BASEMAP_SOURCE } as const;

/** Under the base map's labels. */
export const DETAIL_GROUND: LayerSpecification[] = [
  { id: 'detail-ice', type: 'fill', ...src, 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'ice'],
    paint: { 'fill-color': 'rgba(190, 215, 232, 0.09)' } },
  { id: 'detail-rock-sand', type: 'fill', ...src, 'source-layer': 'landcover', minzoom: 6, filter: ['in', ['get', 'class'], ['literal', ['rock', 'sand']]],
    paint: { 'fill-color': 'rgba(176, 156, 124, 0.06)' } },
  { id: 'detail-industrial', type: 'fill', ...src, 'source-layer': 'landuse', minzoom: 10, filter: ['in', ['get', 'class'], ['literal', ['industrial', 'railway', 'quarry']]],
    paint: { 'fill-color': 'rgba(255, 183, 77, 0.04)' } },
  { id: 'detail-military', type: 'fill', ...src, 'source-layer': 'landuse', minzoom: 7, filter: ['==', ['get', 'class'], 'military'],
    paint: { 'fill-pattern': MILITARY_HATCH, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.5, 11, 1] } },
  { id: 'detail-military-edge', type: 'line', ...src, 'source-layer': 'landuse', minzoom: 9, filter: ['==', ['get', 'class'], 'military'],
    paint: { 'line-color': 'rgba(255, 82, 82, 0.45)', 'line-width': 0.8, 'line-dasharray': [3, 2] } },
  { id: 'detail-ferry', type: 'line', ...src, 'source-layer': 'transportation', minzoom: 4, filter: ['==', ['get', 'class'], 'ferry'],
    paint: { 'line-color': 'rgba(77, 182, 172, 0.55)', 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 12, 1.4], 'line-dasharray': [2, 3] } },
  { id: 'detail-rail', type: 'line', ...src, 'source-layer': 'transportation', minzoom: 7,
    filter: ['all', ['==', ['get', 'class'], 'rail'], ['!', ['has', 'service']]],
    paint: {
      'line-color': 'rgba(150, 160, 182, 0.5)',
      'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.4, 12, 1, 16, 1.6],
      'line-opacity': ['case', ['==', ['get', 'brunnel'], 'tunnel'], 0.35, 1],
    } },
  { id: 'detail-transit', type: 'line', ...src, 'source-layer': 'transportation', minzoom: 11, filter: ['==', ['get', 'class'], 'transit'],
    paint: { 'line-color': 'rgba(129, 212, 250, 0.45)', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 16, 1.6], 'line-dasharray': [2, 1.5] } },
];

const AIRPORT_CODE: ExpressionSpecification = ['concat', '◆ ', ['coalesce', ['get', 'iata'], ['get', 'icao'], '']];
const AIRPORT_COLOR: ExpressionSpecification = ['case', ['==', ['get', 'class'], 'military'], '#FF6E6E', '#90CAF9'];

const POI_COLOR: ExpressionSpecification = ['match', ['get', 'class'],
  ['railway', 'harbor', 'ferry_terminal'], '#81D4FA',
  'hospital', '#EF9A9A',
  ['town_hall', 'police', 'fire_station'], '#CE93D8',
  ['museum', 'castle', 'monument'], '#FFE082',
  'stadium', '#A5D6A7',
  '#B0BEC5'];

/** Over the base map's labels, under every overlay. */
export const DETAIL_LABELS: LayerSpecification[] = [
  { id: 'detail-park-label', type: 'symbol', ...src, 'source-layer': 'park', minzoom: 7, filter: ['==', ['geometry-type'], 'Point'],
    layout: { 'text-field': NAME, 'text-font': ['Noto Sans Italic'], 'text-size': 10, 'text-max-width': 8, 'symbol-sort-key': ['get', 'rank'] },
    paint: { 'text-color': 'rgba(129, 199, 132, 0.75)', ...HALO } },
  { id: 'detail-peak', type: 'symbol', ...src, 'source-layer': 'mountain_peak', minzoom: 7, filter: ['in', ['get', 'class'], ['literal', ['peak', 'volcano']]],
    layout: {
      'text-field': ['format',
        '▲', { 'font-scale': 0.7 }, '\n', {},
        NAME, {},
        ['case', ['has', 'ele'], ['concat', '\n', ['to-string', ['get', 'ele']], ' m'], ''], { 'font-scale': 0.8 }],
      'text-font': ['Noto Sans Regular'], 'text-size': 10, 'text-anchor': 'top', 'text-offset': [0, -0.55], 'text-max-width': 8,
      'symbol-sort-key': ['get', 'rank'],
    },
    paint: { 'text-color': '#C8B89A', ...HALO } },
  // Codes alone from country zoom for the bigger fields, names too once zoomed in.
  { id: 'detail-airport-code', type: 'symbol', ...src, 'source-layer': 'aerodrome_label', minzoom: 7, maxzoom: 10,
    filter: ['in', ['get', 'class'], ['literal', ['international', 'public', 'military']]],
    layout: { 'text-field': AIRPORT_CODE, 'text-font': ['Noto Sans Bold'], 'text-size': 10 },
    paint: { 'text-color': AIRPORT_COLOR, ...HALO } },
  // `other` is glacier strips, helipads and the like, which crowd mountain valleys.
  { id: 'detail-airport', type: 'symbol', ...src, 'source-layer': 'aerodrome_label', minzoom: 10, filter: ['!=', ['get', 'class'], 'other'],
    layout: {
      'text-field': ['format', AIRPORT_CODE, { 'text-font': ['literal', ['Noto Sans Bold']] }, '\n', {}, NAME, { 'font-scale': 0.85 }],
      'text-font': ['Noto Sans Regular'], 'text-size': 10, 'text-max-width': 9,
    },
    paint: { 'text-color': AIRPORT_COLOR, ...HALO } },
  { id: 'detail-poi', type: 'symbol', ...src, 'source-layer': 'poi', minzoom: 14,
    filter: ['all', ['has', 'name'], ['in', ['get', 'class'], ['literal', ['railway', 'harbor', 'ferry_terminal', 'hospital', 'town_hall', 'police', 'fire_station', 'museum', 'castle', 'monument', 'stadium', 'college']]]],
    layout: {
      'text-field': ['format', '● ', { 'font-scale': 0.8 }, ['get', 'name'], {}],
      'text-font': ['Noto Sans Regular'], 'text-size': 10, 'text-anchor': 'left', 'text-offset': [-0.35, 0], 'text-max-width': 10,
      'symbol-sort-key': ['get', 'rank'],
    },
    paint: { 'text-color': POI_COLOR, ...HALO } },
];
