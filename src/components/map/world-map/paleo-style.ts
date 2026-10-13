import type * as maplibregl from 'maplibre-gl';

/* Deep time's sources and layers on the map: the ocean, the grid, the plates and the marks riding them. */

export const SHAPES = 'paleo-shapes';
export const MARKS = 'paleo-marks';
export const TRAILS = 'paleo-trails';
const GRID = 'paleo-grid';
const OCEAN = 'paleo-ocean';
const GRID_LINE = 'paleo-grid-line';
const CRUST = 'paleo-crust';
const LAND = 'paleo-land';
const TRAIL_LINE = 'paleo-trail';
const HEADING = 'paleo-heading';
const ARROW = 'paleo-arrow';
const PLACE_LABELS = 'paleo-place-labels';
const PIN_HALO = 'paleo-pin-halo';
export const PIN_DOT = 'paleo-pin-dot';
const PIN_LABEL = 'paleo-pin-label';
const LAYERS = [PIN_LABEL, PIN_DOT, PIN_HALO, PLACE_LABELS, HEADING, TRAIL_LINE, LAND, CRUST, GRID_LINE, OCEAN];
/** Slower than this a heading arrow says nothing. */
const MIN_ARROW_CM = 0.3;
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

const PALETTE = {
  dark: { ocean: '#0a1621', grid: 'rgba(232,230,224,0.08)', equator: 'rgba(232,195,106,0.4)', crust: '#163041', land: '#4d4632', label: 'rgba(232,230,224,0.72)', speed: '#E8C36A', trail: '232,195,106', halo: 'rgba(8,8,13,0.9)' },
  light: { ocean: '#c6d8e2', grid: 'rgba(20,20,28,0.1)', equator: 'rgba(150,110,30,0.55)', crust: '#a7c0ca', land: '#e2d5b1', label: 'rgba(20,20,28,0.75)', speed: '#7a5a14', trail: '122,90,20', halo: 'rgba(255,255,255,0.85)' },
};

/** A heading arrowhead pointing north, 2× for sharpness. */
function arrowImage(color: string) {
  const size = 28;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.beginPath();
  ctx.moveTo(size / 2, 3);
  ctx.lineTo(size - 6, size - 6);
  ctx.lineTo(size / 2, size - 11);
  ctx.lineTo(6, size - 6);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(8,8,13,0.85)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}


function graticule(): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (let lat = -60; lat <= 60; lat += 30) {
    const line = Array.from({ length: 73 }, (_, i) => [-180 + i * 5, lat]);
    features.push({ type: 'Feature', properties: { equator: lat === 0 }, geometry: { type: 'LineString', coordinates: line } });
  }
  for (let lon = -180; lon < 180; lon += 30) {
    const line = Array.from({ length: 35 }, (_, i) => [lon, -85 + i * 5]);
    features.push({ type: 'Feature', properties: { equator: false }, geometry: { type: 'LineString', coordinates: line } });
  }
  return { type: 'FeatureCollection', features };
}

export function addLayers(map: maplibregl.Map, dark: boolean, attribution: string) {
  const c = dark ? PALETTE.dark : PALETTE.light;
  if (!map.getSource(SHAPES)) map.addSource(SHAPES, { type: 'geojson', data: EMPTY, attribution });
  if (!map.getSource(MARKS)) map.addSource(MARKS, { type: 'geojson', data: EMPTY });
  if (!map.getSource(TRAILS)) map.addSource(TRAILS, { type: 'geojson', data: EMPTY, lineMetrics: true });
  if (!map.getSource(GRID)) map.addSource(GRID, { type: 'geojson', data: graticule() });
  if (!map.hasImage(ARROW)) map.addImage(ARROW, arrowImage(c.speed), { pixelRatio: 2 });
  const text = { 'text-font': ['Noto Sans Regular'], 'text-allow-overlap': false };
  const halo = { 'text-halo-color': c.halo, 'text-halo-width': 1.2 } as const;
  const layers: maplibregl.LayerSpecification[] = [
    { id: OCEAN, type: 'background', paint: { 'background-color': c.ocean } },
    { id: GRID_LINE, type: 'line', source: GRID, paint: {
      'line-color': ['case', ['get', 'equator'], c.equator, c.grid] as never,
      'line-width': ['case', ['get', 'equator'], 1, 0.6] as never,
      'line-dasharray': [3, 3],
    } },
    // The outline in the fill's own colour hides the seams between neighbouring pieces of one plate.
    { id: CRUST, type: 'fill', source: SHAPES, filter: ['==', ['get', 'k'], 'crust'], paint: { 'fill-color': c.crust, 'fill-outline-color': c.crust } },
    { id: LAND, type: 'fill', source: SHAPES, filter: ['==', ['get', 'k'], 'land'], paint: { 'fill-color': c.land, 'fill-outline-color': c.land } },
    // Faint where the place was, full where it is.
    { id: TRAIL_LINE, type: 'line', source: TRAILS, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: {
      'line-width': 2,
      'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, `rgba(${c.trail},0)`, 1, `rgba(${c.trail},0.75)`] as never,
    } },
    { id: HEADING, type: 'symbol', source: MARKS, filter: ['all', ['==', ['get', 'k'], 'place'], ['>=', ['get', 'cm'], MIN_ARROW_CM]] as never, layout: {
      'icon-image': ARROW,
      'icon-rotate': ['get', 'bearing'] as never,
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    } },
    { id: PLACE_LABELS, type: 'symbol', source: MARKS, filter: ['==', ['get', 'k'], 'place'], layout: {
      ...text,
      'text-field': ['format', ['upcase', ['get', 'name']], {}, '\n', {}, ['get', 'speed'], { 'font-scale': 0.92, 'text-color': c.speed }] as never,
      'text-size': 10.5,
      'text-letter-spacing': 0.1,
      'text-anchor': 'top',
      'text-offset': [0, 0.9],
    }, paint: { 'text-color': c.label, ...halo } },
    { id: PIN_HALO, type: 'circle', source: MARKS, filter: ['==', ['get', 'k'], 'pin'], paint: {
      'circle-radius': ['case', ['get', 'current'], 16, 11] as never,
      'circle-color': '#E8C36A',
      'circle-opacity': ['*', ['get', 'o'], 0.18] as never,
      'circle-blur': 0.4,
    } },
    { id: PIN_DOT, type: 'circle', source: MARKS, filter: ['==', ['get', 'k'], 'pin'], paint: {
      'circle-radius': ['case', ['get', 'current'], 6, 4.5] as never,
      'circle-color': '#E8C36A',
      'circle-opacity': ['get', 'o'] as never,
      'circle-stroke-color': '#08080d',
      'circle-stroke-width': 1.5,
      'circle-stroke-opacity': ['get', 'o'] as never,
    } },
    { id: PIN_LABEL, type: 'symbol', source: MARKS, filter: ['==', ['get', 'k'], 'pin'], layout: {
      ...text, 'text-field': ['get', 'title'], 'text-size': 12, 'text-offset': [0, 1.3], 'text-anchor': 'top',
    }, paint: { 'text-color': dark ? '#F0D68C' : '#7a5a14', 'text-opacity': ['get', 'o'] as never, ...halo } },
  ];
  for (const layer of layers) if (!map.getLayer(layer.id)) map.addLayer(layer);
}

export function removeLayers(map: maplibregl.Map) {
  for (const id of LAYERS) if (map.getLayer(id)) map.removeLayer(id);
  for (const id of [SHAPES, MARKS, TRAILS, GRID]) if (map.getSource(id)) map.removeSource(id);
  if (map.hasImage(ARROW)) map.removeImage(ARROW);
}
