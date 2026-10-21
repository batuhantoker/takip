import type * as maplibregl from 'maplibre-gl';
import { t } from '@/lib/core/i18n/active';
import { LABEL_SIZE, MAP_INK, labelPaint } from '@/lib/map/style/tokens';
import { modesText, type TransitCities, type TransitMode } from './modes';
import { TRANSIT_MIN_ZOOM, type TransitResponse, type TransitStop } from './view';

export const TRANSIT_SOURCE = 'transit';
export const TRANSIT_CITY_SOURCE = 'transit-cities';
/** Where each tracked vehicle has been since its window opened; drawn whether or not the layer is on. */
export const TRANSIT_TRAIL_SOURCE = 'transit-trail';
/** Tracked vehicles, moved along their route between fixes, at any zoom. */
export const TRANSIT_TRACKED_SOURCE = 'transit-tracked';
/** Each tracked vehicle's whole route and the stops it calls at. */
export const TRANSIT_ROUTE_SOURCE = 'transit-route';
const VEHICLE_LAYERS = ['transit-dots', 'transit-icons', 'transit-label'];
export const TRANSIT_LAYERS = ['transit-city-dots', 'transit-city-label', 'transit-dots', 'transit-icons', 'transit-label'];
/** The vehicle layers a click or hover lands on. */
export const TRANSIT_PICK_LAYERS = ['transit-dots', 'transit-icons', 'transit-tracked-icon'];
/** Zoomed out: one ring per city with live transit; a click flies in to its vehicles. */
export const TRANSIT_CITY_LAYER = 'transit-city-dots';

export const TRANSIT_COLOR = MAP_INK.sand;
/** Metro, trains, trams and cable cars: what runs on rails reads apart from what runs on the road. */
export const TRANSIT_RAIL_COLOR = MAP_INK.blue;
export const RAIL_MODES: TransitMode[] = ['metro', 'rail', 'tram', 'cable'];
/** Older than this a vehicle is drawn faded: it may have moved on. */
const QUIET_S = 300;
const ICONS_FROM = 13;

const HAS_BEARING: maplibregl.ExpressionSpecification = ['has', 'bearing'];
/** Placed from its stops, not a GPS fix: drawn hollow. */
const ESTIMATED: maplibregl.ExpressionSpecification = ['has', 'estimated'];
const COLOR: maplibregl.ExpressionSpecification = ['match', ['coalesce', ['get', 'mode'], ''], RAIL_MODES, TRANSIT_RAIL_COLOR, TRANSIT_COLOR];
const ICON: maplibregl.ExpressionSpecification = ['case', HAS_BEARING,
  ['case', ESTIMATED, 'transit-heading-hollow', 'transit-heading'],
  ['case', ESTIMATED, 'transit-still-hollow', 'transit-still']];
/** Faded when old news; a train run from the timetable, never live, is quieter still. */
const opacity = (on: number) => ['case', ['>', ['coalesce', ['get', 'age'], 0], QUIET_S], on * 0.4, ['has', 'scheduled'], on * 0.55, on] as maplibregl.ExpressionSpecification;

/** A puck with a notch toward the heading, so a bus is never mistaken for a ship's arrow. */
function addIcons(map: maplibregl.Map) {
  const draw = (id: string, heading: boolean, hollow: boolean) => {
    if (map.hasImage(id)) return;
    const s = 24, c = document.createElement('canvas');
    c.width = s; c.height = s;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(s / 2, s / 2 + 2, hollow ? 5 : 6, 0, Math.PI * 2);
    if (hollow) ctx.stroke(); else ctx.fill();
    if (heading) { ctx.beginPath(); ctx.moveTo(s / 2, 1); ctx.lineTo(s / 2 + 5, 8); ctx.lineTo(s / 2 - 5, 8); ctx.closePath(); ctx.fill(); }
    map.addImage(id, { width: s, height: s, data: new Uint8Array(ctx.getImageData(0, 0, s, s).data) }, { sdf: true });
  };
  draw('transit-heading', true, false);
  draw('transit-still', false, false);
  draw('transit-heading-hollow', true, true);
  draw('transit-still-hollow', false, true);
}

export function addTransitLayers(map: maplibregl.Map) {
  addIcons(map);
  map.addSource(TRANSIT_CITY_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: TRANSIT_CITY_LAYER, type: 'circle', source: TRANSIT_CITY_SOURCE, maxzoom: TRANSIT_MIN_ZOOM, layout: { visibility: 'none' }, paint: {
    // By fleet size, at the probe: a town's shuttle stays small, a metropolis reads from orbit.
    'circle-radius': ['interpolate', ['linear'], ['sqrt', ['get', 'vehicles']], 0, 2.5, 10, 4, 40, 7, 80, 9],
    'circle-color': TRANSIT_COLOR,
    'circle-opacity': 0.25,
    'circle-stroke-width': 1,
    'circle-stroke-color': TRANSIT_COLOR,
    'circle-stroke-opacity': 0.85,
  }});
  map.addLayer({ id: 'transit-city-label', type: 'symbol', source: TRANSIT_CITY_SOURCE, minzoom: 4, maxzoom: TRANSIT_MIN_ZOOM, layout: {
    visibility: 'none',
    'text-field': ['step', ['zoom'], ['get', 'name'], 6,
      ['format', ['get', 'name'], {}, '\n', {}, ['get', 'modes'], { 'font-scale': 0.85, 'text-color': MAP_INK.ink3 }]],
    'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 0.9], 'text-anchor': 'top', 'text-max-width': 18, 'text-optional': true, 'text-allow-overlap': false,
    'symbol-sort-key': ['-', 0, ['get', 'vehicles']],
  }, paint: labelPaint(MAP_INK.ink2) });
  map.addSource(TRANSIT_ROUTE_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'transit-route-line', type: 'line', source: TRANSIT_ROUTE_SOURCE, filter: ['==', ['geometry-type'], 'LineString'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: {
    'line-color': COLOR,
    'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 15, 4],
    'line-opacity': 0.5,
  }});
  map.addSource(TRANSIT_TRAIL_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'transit-trail', type: 'line', source: TRANSIT_TRAIL_SOURCE, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: {
    'line-color': TRANSIT_COLOR,
    'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 15, 3],
    'line-opacity': 0.75,
  }});
  map.addLayer({ id: 'transit-route-stops', type: 'circle', source: TRANSIT_ROUTE_SOURCE, minzoom: 11, filter: ['==', ['geometry-type'], 'Point'], paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 2, 16, 4.5],
    'circle-color': MAP_INK.surface0,
    'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 16, 1.75],
    'circle-stroke-color': COLOR,
  }});
  map.addLayer({ id: 'transit-route-stop-label', type: 'symbol', source: TRANSIT_ROUTE_SOURCE, minzoom: 14, filter: ['==', ['geometry-type'], 'Point'], layout: {
    'text-field': ['get', 'name'],
    'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 0.8], 'text-anchor': 'top', 'text-max-width': 10, 'text-optional': true,
  }, paint: labelPaint(MAP_INK.ink2) });
  map.addSource(TRANSIT_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'transit-dots', type: 'circle', source: TRANSIT_SOURCE, minzoom: TRANSIT_MIN_ZOOM, maxzoom: ICONS_FROM, layout: { visibility: 'none' }, paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], TRANSIT_MIN_ZOOM, 2.2, ICONS_FROM, 3.6],
    'circle-color': ['case', ESTIMATED, MAP_INK.surface0, COLOR],
    'circle-opacity': opacity(0.9),
    'circle-stroke-width': ['case', ESTIMATED, 1.4, 1],
    'circle-stroke-color': ['case', ESTIMATED, COLOR, MAP_INK.surface0],
    'circle-stroke-opacity': opacity(0.9),
  }});
  map.addLayer({ id: 'transit-icons', type: 'symbol', source: TRANSIT_SOURCE, minzoom: ICONS_FROM, layout: {
    visibility: 'none',
    'icon-image': ICON,
    'icon-size': ['interpolate', ['linear'], ['zoom'], ICONS_FROM, 0.6, 17, 0.95],
    'icon-rotate': ['case', HAS_BEARING, ['to-number', ['get', 'bearing']], 0],
    'icon-rotation-alignment': 'map',
    'icon-allow-overlap': true, 'icon-ignore-placement': true,
  }, paint: { 'icon-color': COLOR, 'icon-opacity': opacity(1) }});
  map.addLayer({ id: 'transit-label', type: 'symbol', source: TRANSIT_SOURCE, minzoom: 14, layout: {
    visibility: 'none',
    // Short route ids only: some feeds send internal ones ("NBU:Line:cb7b…").
    'text-field': ['case', ['<=', ['length', ['to-string', ['coalesce', ['get', 'route'], '']]], 6], ['coalesce', ['get', 'route'], ''], ''],
    'text-size': LABEL_SIZE, 'text-font': ['Noto Sans Regular'],
    'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-optional': true, 'text-allow-overlap': false,
  }, paint: labelPaint(MAP_INK.ink2) });
  addTrackedLayers(map);
}

function addTrackedLayers(map: maplibregl.Map) {
  map.addSource(TRANSIT_TRACKED_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  // The selection ring's look (inspect/selection-rings), drawn here so it moves with the vehicle.
  map.addLayer({ id: 'transit-tracked-ring', type: 'circle', source: TRANSIT_TRACKED_SOURCE, paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 9, 10, 12, 16, 15],
    'circle-color': 'transparent',
    'circle-stroke-color': MAP_INK.ink1,
    'circle-stroke-width': 1.75,
    'circle-stroke-opacity': 0.95,
  }});
  map.addLayer({ id: 'transit-tracked-icon', type: 'symbol', source: TRANSIT_TRACKED_SOURCE, layout: {
    'icon-image': ICON,
    'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 13, 0.75, 17, 1],
    'icon-rotate': ['case', HAS_BEARING, ['to-number', ['get', 'bearing']], 0],
    'icon-rotation-alignment': 'map',
    'icon-allow-overlap': true, 'icon-ignore-placement': true,
  }, paint: { 'icon-color': COLOR }});
}

let hidden = '';

/** Draws the tracked vehicles where their glide has them, and hides their copies in the live layer. */
export function setTransitTracked(map: maplibregl.Map, tracked: { key: string; at: [number, number]; bearing: number | null; mode?: TransitMode; estimated?: boolean }[]) {
  setTransitData(map, tracked.map(v => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: v.at },
    properties: Object.fromEntries(Object.entries({ key: v.key, bearing: v.bearing, mode: v.mode, estimated: v.estimated || null }).filter(([, x]) => x != null)),
  })), TRANSIT_TRACKED_SOURCE);
  // Called every animation frame; a new filter re-lays out every vehicle, so only when the set changes.
  const keys = tracked.map(v => v.key);
  if (keys.join('\n') === hidden) return;
  hidden = keys.join('\n');
  const hide: maplibregl.FilterSpecification | null = keys.length ? ['!', ['in', ['get', 'key'], ['literal', keys]]] : null;
  for (const id of VEHICLE_LAYERS) if (map.getLayer(id)) map.setFilter(id, hide);
}

export function setTransitVisible(map: maplibregl.Map, on: boolean) {
  for (const id of TRANSIT_LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
}

export function setTransitData(map: maplibregl.Map, features: GeoJSON.Feature[], source = TRANSIT_SOURCE) {
  (map.getSource(source) as maplibregl.GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
}

export interface TransitRoute {
  shape: [number, number][] | null;
  stops: TransitStop[] | null;
  mode?: TransitMode;
}

const routes = new Map<string, TransitRoute[]>();

/** Draws one owner's routes (a tracked vehicle's trip, the focused line) beside the others'; null takes them away. */
export function setTransitRoutes(map: maplibregl.Map, owner: string, drawn: TransitRoute[] | null) {
  if (drawn?.length) routes.set(owner, drawn);
  else routes.delete(owner);
  setTransitData(map, [...routes.values()].flat().flatMap(({ shape, stops, mode }): GeoJSON.Feature[] => {
    const props = mode ? { mode } : {};
    return [
      ...(shape && shape.length > 1 ? [{ type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: shape }, properties: props }] : []),
      ...(stops ?? []).map(([lng, lat, name]) => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [lng, lat] }, properties: { ...props, name } })),
    ];
  }), TRANSIT_ROUTE_SOURCE);
}

const DIMMED = 0.2;

/** Every vehicle off the focused line fades, so its own stand out; null brings them all back. */
export function setTransitLineFocus(map: maplibregl.Map, line: { feed: string; route: string } | null) {
  const onLine: maplibregl.ExpressionSpecification | null = line
    ? ['all', ['==', ['get', 'route'], line.route], ['==', ['index-of', `${line.feed}:`, ['get', 'key']], 0]]
    : null;
  const keep = (full: maplibregl.ExpressionSpecification | number): maplibregl.DataDrivenPropertyValueSpecification<number> =>
    onLine ? ['case', onLine, full, DIMMED] : full;
  const paint: [string, 'circle-opacity' | 'circle-stroke-opacity' | 'icon-opacity' | 'text-opacity', maplibregl.ExpressionSpecification | number][] = [
    ['transit-dots', 'circle-opacity', opacity(0.9)], ['transit-dots', 'circle-stroke-opacity', opacity(0.9)],
    ['transit-icons', 'icon-opacity', opacity(1)], ['transit-label', 'text-opacity', 1],
  ];
  for (const [id, prop, full] of paint) if (map.getLayer(id)) map.setPaintProperty(id, prop, keep(full));
}

export function setTransitTrails(map: maplibregl.Map, trails: [number, number][][]) {
  setTransitData(map, trails.filter(trail => trail.length > 1).map(coordinates => ({ type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: {} })), TRANSIT_TRAIL_SOURCE);
}

export function transitCityFeatures({ cities }: TransitCities): GeoJSON.Feature<GeoJSON.Point>[] {
  return cities.map(c => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: c.at },
    properties: { name: c.name, cc: c.cc, modes: modesText(c.modes, t), vehicles: c.vehicles, operators: c.operators.join(' · ') },
  }));
}

export function transitFeatures(res: TransitResponse): GeoJSON.Feature<GeoJSON.Point>[] {
  return res.vehicles.map(v => {
    const feed = res.feeds[v.feed];
    const props = {
      key: v.key, route: v.route, trip: v.trip, label: v.label, plate: v.plate, operator: v.operator,
      bearing: v.bearing, speed: v.speed, status: v.status, age: v.age,
      mode: v.mode, stop: v.stop, from: v.from, estimated: v.estimated || null, scheduled: v.scheduled || null,
      feed: feed?.name, license: feed?.license,
    };
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [v.lng, v.lat] },
      // Only what the feed sent: an `undefined` key would still pass the `has` tests above.
      properties: Object.fromEntries(Object.entries(props).filter(([, x]) => x != null && x !== '')),
    };
  });
}
