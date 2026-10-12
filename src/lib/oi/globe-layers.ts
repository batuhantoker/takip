import type { FilterSpecification, Map as MlMap } from 'maplibre-gl';

export const NODES = 'oi-nodes';
export const LAYERS = ['oi-node-halo', 'oi-node-core', 'oi-label-actor', 'oi-label-agent', 'oi-label-forecast'] as const;

export const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export function ensureNodeLayers(map: MlMap): void {
  if (!map.getSource(NODES)) map.addSource(NODES, { type: 'geojson', data: EMPTY });
  if (!map.getLayer('oi-node-halo')) {
    map.addLayer({
      id: 'oi-node-halo', type: 'circle', source: NODES,
      paint: {
        'circle-radius': ['get', 'halo'],
        'circle-color': ['get', 'color'],
        'circle-opacity': ['case', ['==', ['get', 'sel'], 1], 0.32, ['==', ['get', 'dim'], 1], 0.05, 0.16],
        'circle-blur': 0.7,
        'circle-pitch-alignment': 'map',
      },
    });
  }
  if (!map.getLayer('oi-node-core')) {
    map.addLayer({
      id: 'oi-node-core', type: 'circle', source: NODES,
      paint: {
        'circle-radius': ['get', 'radius'],
        'circle-color': ['get', 'color'],
        'circle-opacity': ['case', ['==', ['get', 'dim'], 1], 0.3, ['==', ['get', 'kind'], 'context'], 0.75, 0.95],
        'circle-stroke-width': ['case', ['==', ['get', 'sel'], 1], 2.5, ['==', ['get', 'kind'], 'actor'], 1.5, 1],
        'circle-stroke-color': ['case', ['==', ['get', 'sel'], 1], '#ffffff', ['==', ['get', 'kind'], 'actor'], 'rgba(243,234,255,0.9)', 'rgba(10,6,20,0.9)'],
      },
    });
  }
  const label = (id: string, filter: FilterSpecification, size: number, minzoom = 0) => {
    if (map.getLayer(id)) return;
    map.addLayer({
      id, type: 'symbol', source: NODES, filter, minzoom,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Open Sans Bold'],
        'text-size': size,
        'text-offset': [0, 1.1],
        'text-anchor': 'top',
        'text-max-width': 12,
        'text-allow-overlap': false,
        'text-optional': true,
      },
      paint: {
        'text-color': ['case', ['==', ['get', 'dim'], 1], 'rgba(239,228,255,0.32)', '#EFE4FF'],
        'text-halo-color': 'rgba(8,4,18,0.92)',
        'text-halo-width': 1.4,
      },
    });
  };
  // Actors, scenarios and signposts are always named; an event is named once the view is close, or when selected.
  label('oi-label-actor', ['any', ['in', ['get', 'kind'], ['literal', ['actor', 'scenario', 'signpost']]], ['all', ['==', ['get', 'kind'], 'event'], ['==', ['get', 'sel'], 1]]], 10);
  label('oi-label-agent', ['all', ['==', ['get', 'kind'], 'event'], ['!=', ['get', 'sel'], 1]], 9, 2.4);
  if (!map.getLayer('oi-label-forecast')) {
    map.addLayer({
      id: 'oi-label-forecast', type: 'symbol', source: NODES, filter: ['==', ['get', 'kind'], 'focus'],
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Open Sans Bold'],
        'text-size': 14,
        'text-letter-spacing': 0.06,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: { 'text-color': '#F5ECFF', 'text-halo-color': 'rgba(120,60,220,0.55)', 'text-halo-width': 2.2, 'text-halo-blur': 1.2 },
    });
  }
}
