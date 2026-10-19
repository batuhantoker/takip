import type * as maplibregl from 'maplibre-gl';
import { LABEL_SIZE, MAP_INK, MARKER_STROKE, labelPaint, markerRadius } from '@/lib/map/style/tokens';
import type { AirportWx, FlightCategory } from './metar';
import { t } from '@/lib/core/i18n/active';
import { sigmetTitle, type Sigmet } from './sigmet';

export const AIRPORT_WX_SOURCE = 'airport-wx';
export const SIGMET_SOURCE = 'sigmets';
export const AIRPORT_WX_LAYERS = ['airport-wx-dots', 'airport-wx-label'];
export const SIGMET_LAYERS = ['sigmet-fill', 'sigmet-line', 'sigmet-label'];
export const AIRPORT_WX_PICK = 'airport-wx-dots';
export const SIGMET_PICK = 'sigmet-fill';

/** The usual aviation chart colours, in MAP_INK's tones. */
export const FLIGHT_CATEGORY_COLOR: Record<FlightCategory, string> = {
  VFR: MAP_INK.green, MVFR: MAP_INK.blue, IFR: MAP_INK.red, LIFR: MAP_INK.violet,
};
export const SIGMET_COLOR: Record<string, string> = {
  TS: MAP_INK.amber, TSGR: MAP_INK.amber, TURB: MAP_INK.rose, MTW: MAP_INK.rose, ICE: MAP_INK.teal,
  VA: MAP_INK.red, TC: MAP_INK.violet,
};
export const sigmetColor = (hazard: unknown) => SIGMET_COLOR[String(hazard)] ?? MAP_INK.sand;
export const categoryColor = (cat: unknown) => FLIGHT_CATEGORY_COLOR[cat as FlightCategory] ?? MAP_INK.slate;

const RANK: Record<string, number> = { LIFR: 4, IFR: 3, MVFR: 2, VFR: 1 };

export function addAviationWeatherLayers(map: maplibregl.Map) {
  const empty = { type: 'FeatureCollection' as const, features: [] };
  map.addSource(SIGMET_SOURCE, { type: 'geojson', data: empty });
  // Areas sit under the point layers, flights included.
  const below = map.getLayer('gnss-fill') ? 'gnss-fill' : undefined;
  map.addLayer({ id: 'sigmet-fill', type: 'fill', source: SIGMET_SOURCE, layout: { visibility: 'none' }, paint: {
    'fill-color': ['get', 'color'], 'fill-opacity': 0.14,
  }}, below);
  map.addLayer({ id: 'sigmet-line', type: 'line', source: SIGMET_SOURCE, layout: { visibility: 'none' }, paint: {
    'line-color': ['get', 'color'], 'line-width': 1, 'line-opacity': 0.7,
  }}, below);
  map.addLayer({ id: 'sigmet-label', type: 'symbol', source: SIGMET_SOURCE, minzoom: 3, layout: {
    visibility: 'none',
    'text-field': ['get', 'title'], 'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Regular'],
    'text-max-width': 10, 'text-optional': true, 'text-allow-overlap': false,
  }, paint: labelPaint(MAP_INK.ink2) }, below);

  map.addSource(AIRPORT_WX_SOURCE, { type: 'geojson', data: empty });
  map.addLayer({ id: 'airport-wx-dots', type: 'circle', source: AIRPORT_WX_SOURCE, layout: {
    visibility: 'none',
    'circle-sort-key': ['coalesce', ['get', 'rank'], 0],
  }, paint: {
    'circle-radius': markerRadius(1.8, 3.2, 5),
    'circle-color': ['get', 'color'],
    // Good weather recedes so the bad weather reads at a glance.
    'circle-opacity': ['case', ['<=', ['get', 'rank'], 1], 0.5, 0.92],
    ...MARKER_STROKE,
  }});
  map.addLayer({ id: 'airport-wx-label', type: 'symbol', source: AIRPORT_WX_SOURCE, minzoom: 7, layout: {
    visibility: 'none',
    'text-field': ['get', 'id'], 'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1], 'text-anchor': 'top', 'text-optional': true, 'text-allow-overlap': false,
  }, paint: labelPaint(MAP_INK.ink3) });
}

export function setAviationWeatherVisible(map: maplibregl.Map, layers: string[], on: boolean) {
  for (const id of layers) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
}

export function setAviationWeatherData(map: maplibregl.Map, source: string, features: GeoJSON.Feature[]) {
  (map.getSource(source) as maplibregl.GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
}

export function airportWxFeatures(rows: AirportWx[]): GeoJSON.Feature<GeoJSON.Point>[] {
  return rows.map(({ lat, lng, ...r }) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    // Only what the station sent: an absent value must not reach the popup as "undefined".
    properties: Object.fromEntries(Object.entries({ ...r, color: categoryColor(r.cat), rank: RANK[r.cat ?? ''] ?? 0 }).filter(([, v]) => v != null && v !== '')),
  }));
}

export function sigmetFeatures(rows: Sigmet[]): GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>[] {
  return rows.map(({ rings, ...s }) => ({
    type: 'Feature',
    geometry: rings.length === 1
      ? { type: 'Polygon', coordinates: [rings[0]] }
      : { type: 'MultiPolygon', coordinates: rings.map(r => [r]) },
    properties: Object.fromEntries(Object.entries({ ...s, title: sigmetTitle(s.hazard, s.qualifier, t), color: sigmetColor(s.hazard) }).filter(([, v]) => v != null && v !== '')),
  }));
}
