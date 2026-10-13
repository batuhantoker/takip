'use client';

import { useEffect } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { maAt } from '@/lib/paleo/deep-time';
import { loadPlateModel, type Pin, type PlateModel } from '@/lib/paleo/reconstruct';
import { CHAPTERS, PLACES, TRAVEL_MS } from '@/lib/paleo/story';
import type { HistorySession } from '@/lib/history/session';
import type { MapRef } from './types';

/*
 * History's deep time on the map: an opaque ocean over the whole basemap, today's coastlines and crust
 * carried back on their plates, a graticule to read their drift against, today's place names riding along,
 * and a pin for each documentary chapter. Everything sits on top; only the basemap's labels need hiding.
 */

const SHAPES = 'paleo-shapes';
const MARKS = 'paleo-marks';
const GRID = 'paleo-grid';
const OCEAN = 'paleo-ocean';
const GRID_LINE = 'paleo-grid-line';
const CRUST = 'paleo-crust';
const LAND = 'paleo-land';
const PLACE_LABELS = 'paleo-place-labels';
const PIN_HALO = 'paleo-pin-halo';
const PIN_DOT = 'paleo-pin-dot';
const PIN_LABEL = 'paleo-pin-label';
const LAYERS = [PIN_LABEL, PIN_DOT, PIN_HALO, PLACE_LABELS, LAND, CRUST, GRID_LINE, OCEAN];
const FRAME_MS = 100;
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const RAD = Math.PI / 180;
/** The camera stays within this latitude; past it the globe's Mercator zoom swells and a pole fills the screen. */
const MAX_CAMERA_LAT = 40;

/** The globe draws zoom at Mercator scale for the centre's latitude; this keeps it the same size anywhere. */
const globeZoom = (map: maplibregl.Map, zoom: number, lat: number) => Math.max(map.getMinZoom(), zoom + Math.log2(Math.cos(lat * RAD)));

const PALETTE = {
  dark: { ocean: '#0a1621', grid: 'rgba(232,230,224,0.08)', equator: 'rgba(232,195,106,0.4)', crust: '#163041', land: '#4d4632', label: 'rgba(232,230,224,0.72)', halo: 'rgba(8,8,13,0.9)' },
  light: { ocean: '#c6d8e2', grid: 'rgba(20,20,28,0.1)', equator: 'rgba(150,110,30,0.55)', crust: '#a7c0ca', land: '#e2d5b1', label: 'rgba(20,20,28,0.75)', halo: 'rgba(255,255,255,0.85)' },
};

/** A pin shows from its chapter's age for a while after: longer in the deep past, where the clock runs faster. */
const linger = (ma: number) => Math.min(120, Math.max(12, ma * 0.15));

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

function addLayers(map: maplibregl.Map, dark: boolean, attribution: string) {
  const c = dark ? PALETTE.dark : PALETTE.light;
  if (!map.getSource(SHAPES)) map.addSource(SHAPES, { type: 'geojson', data: EMPTY, attribution });
  if (!map.getSource(MARKS)) map.addSource(MARKS, { type: 'geojson', data: EMPTY });
  if (!map.getSource(GRID)) map.addSource(GRID, { type: 'geojson', data: graticule() });
  const text = { 'text-font': ['Open Sans Regular'], 'text-allow-overlap': false };
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
    { id: PLACE_LABELS, type: 'symbol', source: MARKS, filter: ['==', ['get', 'k'], 'place'], layout: {
      ...text, 'text-field': ['get', 'name'], 'text-size': 10.5, 'text-letter-spacing': 0.12, 'text-transform': 'uppercase',
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

function removeLayers(map: maplibregl.Map) {
  for (const id of LAYERS) if (map.getLayer(id)) map.removeLayer(id);
  for (const id of [SHAPES, MARKS, GRID]) if (map.getSource(id)) map.removeSource(id);
}

export function usePaleoLayer({ mapRef, mapReady, history, mapStyle }: {
  mapRef: MapRef;
  mapReady: boolean;
  history: HistorySession | null;
  mapStyle: string;
}) {
  const dark = mapStyle !== 'topo';

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !history) return;
    let model: PlateModel | null = null;
    let places: { name: string; pin: Pin }[] = [];
    let pins: (Pin | null)[] = [];
    let shown = false;
    let mutedLabels: string[] = [];
    let appliedMa = NaN;
    let appliedChapter: number | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let loading = false;
    let gone = false;

    const marks = (ma: number): GeoJSON.FeatureCollection => {
      const features: GeoJSON.Feature[] = [];
      for (const p of places) {
        const at = model!.where(p.pin, ma);
        if (at) features.push({ type: 'Feature', properties: { k: 'place', name: p.name }, geometry: { type: 'Point', coordinates: at } });
      }
      const current = history.story.index();
      CHAPTERS.forEach((ch, i) => {
        const pin = pins[i];
        if (!pin || ch.pin === false) return;
        const age = ch.ma - ma;
        const isCurrent = i === current && history.story.arrived();
        if (!isCurrent && (age < 0 || age > linger(ch.ma))) return;
        const at = model!.where(pin, ma);
        if (!at) return;
        const o = isCurrent ? 1 : 1 - 0.6 * (age / linger(ch.ma));
        features.push({ type: 'Feature', properties: { k: 'pin', i, title: ch.title, o, current: isCurrent }, geometry: { type: 'Point', coordinates: at } });
      });
      return { type: 'FeatureCollection', features };
    };

    const paint = (force = false) => {
      if (!model || !shown) return;
      const ma = maAt(history.deepClock.time());
      if (!force && Math.abs(ma - appliedMa) < 0.01) return;
      appliedMa = ma;
      (map.getSource(SHAPES) as maplibregl.GeoJSONSource | undefined)?.setData(model.at(ma));
      (map.getSource(MARKS) as maplibregl.GeoJSONSource | undefined)?.setData(marks(ma));
    };

    const flyToChapter = () => {
      const i = history.story.index();
      if (i === appliedChapter) return;
      appliedChapter = i;
      if (i === null) return northUp();
      if (!model) return;
      const ch = CHAPTERS[i];
      const pin = pins[i];
      const at = pin && model.where(pin, ch.ma);
      if (!at) return;
      const lat = Math.max(-MAX_CAMERA_LAT, Math.min(MAX_CAMERA_LAT, at[1]));
      // The chapter card covers the lower middle, so the place goes above it: raised in the tropics, and south
      // up for a place near the South Pole, which then sits beyond the camera's latitude toward the top.
      const south = at[1] < -MAX_CAMERA_LAT;
      const raise = Math.abs(at[1]) <= MAX_CAMERA_LAT ? Math.round(map.getCanvas().clientHeight * 0.18) : 0;
      map.flyTo({
        center: [at[0], lat],
        zoom: globeZoom(map, ch.zoom, lat),
        bearing: south ? 180 : 0,
        offset: [0, -raise],
        duration: history.story.arrived() ? 1800 : TRAVEL_MS,
        essential: true,
      });
    };

    // On the globe, symbols near the limb draw over the ocean layer, so today's names would show through.
    const muteLabels = () => {
      mutedLabels = (map.getStyle().layers ?? [])
        .filter(l => l.type === 'symbol' && !l.id.startsWith('paleo-') && map.getLayoutProperty(l.id, 'visibility') !== 'none')
        .map(l => l.id);
      for (const id of mutedLabels) map.setLayoutProperty(id, 'visibility', 'none');
    };
    const restoreLabels = () => {
      for (const id of mutedLabels) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
      mutedLabels = [];
    };

    // A south-up chapter view shouldn't outlast the story.
    const northUp = () => { if (Math.abs(map.getBearing()) > 1) map.easeTo({ bearing: 0, duration: 800 }); };
    const zoomOut = () => {
      if (!shown || history.story.index() !== null) return;
      const lat = Math.max(-MAX_CAMERA_LAT, Math.min(MAX_CAMERA_LAT, map.getCenter().lat));
      const zoom = globeZoom(map, 2, lat);
      if (map.getZoom() > zoom + 0.5) map.easeTo({ center: [map.getCenter().lng, lat], zoom, duration: 1200 });
    };
    const show = () => {
      if (shown || !model) return;
      shown = true;
      muteLabels();
      addLayers(map, dark, model.meta.attribution);
      // A camera flight already under way would cancel the ease; wait for it to land.
      if (map.isMoving()) map.once('moveend', zoomOut);
      else zoomOut();
      paint(true);
      flyToChapter();
    };
    const hide = () => {
      if (!shown) return;
      shown = false;
      if (appliedChapter !== null) northUp();
      appliedChapter = null;
      removeLayers(map);
      restoreLabels();
    };

    const sync = () => {
      if (!history.deep()) return hide();
      if (!model) {
        if (loading) return;
        loading = true;
        loadPlateModel().then(m => {
          loading = false;
          if (gone) return;
          model = m;
          places = PLACES.flatMap(([name, lon, lat]) => {
            const pin = m.pin(lon, lat);
            return pin ? [{ name, pin }] : [];
          });
          pins = CHAPTERS.map(ch => m.pin(...ch.place));
          if (history.deep()) show();
        }, () => { loading = false; });
        return;
      }
      show();
    };

    const tick = () => {
      timer = undefined;
      paint();
    };
    const schedule = () => { timer ??= setTimeout(tick, FRAME_MS); };
    const onStory = () => {
      if (!shown) return;
      flyToChapter();
      paint(true);
    };

    const onPinClick = (e: maplibregl.MapLayerMouseEvent) => {
      const i = e.features?.[0]?.properties?.i;
      if (typeof i === 'number') history.story.go(i);
    };
    const pointer = () => { map.getCanvas().style.cursor = 'pointer'; };
    const unpointer = () => { map.getCanvas().style.cursor = ''; };
    map.on('click', PIN_DOT, onPinClick);
    map.on('mouseenter', PIN_DOT, pointer);
    map.on('mouseleave', PIN_DOT, unpointer);

    const offs = [history.subscribe(sync), history.deepClock.subscribe(schedule), history.story.subscribe(onStory)];
    sync();

    return () => {
      gone = true;
      clearTimeout(timer);
      offs.forEach(off => off());
      try {
        map.off('click', PIN_DOT, onPinClick);
        map.off('mouseenter', PIN_DOT, pointer);
        map.off('mouseleave', PIN_DOT, unpointer);
        map.off('moveend', zoomOut);
        removeLayers(map);
        restoreLabels();
      } catch {
        // The map itself was removed (a theme change remounts it), taking its layers with it.
      }
    };
  }, [mapRef, mapReady, history, dark]);
}
