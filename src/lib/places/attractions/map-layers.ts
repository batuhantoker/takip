import type * as maplibregl from 'maplibre-gl';
import { LABEL_SIZE, MAP_INK, labelPaint } from '@/lib/map/style/tokens';
import { KIND_GROUPS } from '@/lib/platform/site/places/topics/attractions-data';
import type { SpotCollection } from './spots';
import { FIRST_ZOOM } from './zoom';

/** The things-to-do layer: a dot per place, coloured by its section on the place pages, named from zoom 9. */

export const ATTRACTIONS_SOURCE = 'attractions';
export const ATTRACTION_DOTS = 'attraction-dots';
export const ATTRACTION_LABELS = 'attraction-labels';
const LAYERS = [ATTRACTION_DOTS, ATTRACTION_LABELS];

export const GROUP_COLOR: Record<string, string> = {
  museums: MAP_INK.rose, landmarks: MAP_INK.sand, historic: MAP_INK.teal, worship: MAP_INK.violet, outdoors: MAP_INK.green,
};

export const ATTRACTIONS_ATTRIBUTION = '<a href="https://www.wikidata.org/" target="_blank" rel="noopener">Wikidata</a> (CC0)';

const EMPTY: SpotCollection = { type: 'FeatureCollection', features: [], truncated: false };

const kindColor = ['match', ['get', 'k'],
  ...KIND_GROUPS.flatMap(g => [g.kinds, GROUP_COLOR[g.id]]), MAP_INK.slate] as unknown as maplibregl.ExpressionSpecification;
/** Articles in 3 to 100+ Wikipedias, on a log scale. */
const fame: maplibregl.ExpressionSpecification = ['min', 1, ['/', ['ln', ['max', 1, ['/', ['get', 'l'], 3]]], 3.5]];

export function addAttractionLayers(map: maplibregl.Map) {
  map.addSource(ATTRACTIONS_SOURCE, { type: 'geojson', data: EMPTY, attribution: ATTRACTIONS_ATTRIBUTION });
  map.addLayer({
    id: ATTRACTION_DOTS, type: 'circle', source: ATTRACTIONS_SOURCE, minzoom: FIRST_ZOOM,
    layout: { visibility: 'none', 'circle-sort-key': ['get', 'l'] },
    paint: {
      'circle-color': kindColor,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], FIRST_ZOOM, ['+', 2, ['*', 2, fame]], 10, ['+', 3.5, ['*', 2.5, fame]], 15, ['+', 5, ['*', 3, fame]]],
      'circle-opacity': 0.9,
      // World Heritage sites get a light ring.
      'circle-stroke-width': ['case', ['has', 'h'], 1.5, 1],
      'circle-stroke-color': ['case', ['has', 'h'], MAP_INK.ink1, MAP_INK.surface0],
      'circle-stroke-opacity': 0.85,
    },
  });
  map.addLayer({
    id: ATTRACTION_LABELS, type: 'symbol', source: ATTRACTIONS_SOURCE, minzoom: 9,
    layout: {
      visibility: 'none',
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Regular'],
      'text-size': LABEL_SIZE,
      'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
      'text-radial-offset': 0.8,
      'text-justify': 'auto',
      'text-max-width': 10,
      'text-optional': true,
      'symbol-sort-key': ['-', 0, ['get', 'l']],
    },
    paint: labelPaint(),
  });
}

export function setAttractionsVisible(map: maplibregl.Map, on: boolean) {
  for (const id of LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
}

export function setAttractionsData(map: maplibregl.Map, data: SpotCollection | null) {
  (map.getSource(ATTRACTIONS_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(data ?? EMPTY);
}
