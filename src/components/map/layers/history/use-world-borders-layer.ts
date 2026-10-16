'use client';

import { type RefObject, useEffect } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { HistorySession } from '@/lib/history/session';
import { borderWindow, clockYear, powerColor, WORLD_BORDERS, type WorldBorderFeature, yearStart } from '@/lib/history/world-borders';
import { MAP_INK, labelPaint } from '@/lib/map/style/tokens';
import type { MapRef } from '@/components/map/types';
import { hideModernBorders } from './modern-borders';
import { openWorldBorderPopup } from './world-border-popup';

/*
 * World borders in History: Cliopatria's polities in the clock's year, each coloured by the empire or union holding it.
 * One fetch per span of years, zoom band and view from /api/replay/history/features; the clock only moves the filter.
 */

const CODE = WORLD_BORDERS.code;
const SOURCE = 'world-borders';
const FILL = 'world-borders-fill';
const LINE = 'world-borders-line';
const LABELS = 'world-borders-labels';
const FRAME_MS = 125;
const RETRY_MS = 10_000;
const FOREVER_S = 8.64e12;
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/** Zoom bands of the feature index (generalize.ts ZBANDS): a new band means another simplification. */
const band = (z: number) => (z <= 2 ? 0 : z <= 4 ? 1 : z <= 6 ? 2 : z <= 9 ? 3 : 4);

type Box = { w: number; s: number; e: number; n: number };
const WORLD: Box = { w: -180, s: -90, e: 180, n: 90 };
const covers = (a: Box, b: Box) => a.w <= b.w && a.e >= b.e && a.s <= b.s && a.n >= b.n;

const isShape = ['!', ['has', 'label']];
const at = (t: number) => ['all', ['<=', ['get', 't0'], t], ['>', ['coalesce', ['get', 't1'], FOREVER_S], t]];

function addLayers(map: maplibregl.Map) {
  if (!map.getSource(SOURCE)) map.addSource(SOURCE, { type: 'geojson', data: EMPTY });
  // Under the basemap's labels, like the wartime borders; the events layer stays above.
  const before = map.getStyle().layers?.find(l => l.type === 'symbol')?.id;
  if (!map.getLayer(FILL)) map.addLayer({ id: FILL, type: 'fill', source: SOURCE, filter: isShape as never, paint: {
    'fill-color': ['get', 'color'],
    // Drawn for world scale: the coastlines spill over the sea up close, so the fill fades there.
    'fill-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.28, 8, 0.08] as never,
  } }, before);
  if (!map.getLayer(LINE)) map.addLayer({ id: LINE, type: 'line', source: SOURCE, filter: isShape as never, paint: {
    'line-color': MAP_INK.ink2,
    // OpenHistoricalMap's dated borders take over up close (use-ohm-detail-layer); this one is drawn for world scale.
    'line-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.45, 9, 0.15] as never,
    'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.5, 6, 1] as never,
  } }, before);
  if (!map.getLayer(LABELS)) map.addLayer({ id: LABELS, type: 'symbol', source: SOURCE, minzoom: 1, filter: ['has', 'label'] as never, layout: {
    'text-field': ['get', 'name'],
    'text-font': ['Noto Sans Regular'],
    'text-size': ['interpolate', ['linear'], ['zoom'], 1, 10, 6, 13] as never,
    'text-max-width': 8,
    'symbol-sort-key': ['-', 0, ['coalesce', ['get', 'area'], 0]] as never,
  }, paint: labelPaint(MAP_INK.ink1) });
}

function removeLayers(map: maplibregl.Map) {
  for (const id of [LABELS, LINE, FILL]) if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(SOURCE)) map.removeSource(SOURCE);
}

type Loaded = { from: number; next: number; band: number; box: Box };

export function useWorldBordersLayer({ mapRef, mapReady, history, popupRef }: {
  mapRef: MapRef;
  mapReady: boolean;
  history: HistorySession | null;
  popupRef: RefObject<maplibregl.Popup | null>;
}) {
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !history) return;
    let shown = false;
    let loaded: Loaded | null = null;
    let generation = 0;
    let retryAt = 0;
    let appliedFrom = NaN;
    let unhide: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const setData = (data: GeoJSON.FeatureCollection) => (map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(data);

    const load = (t: number) => {
      const w = borderWindow(t);
      if (!w) {
        if (loaded) setData(EMPTY);
        loaded = null;
        generation++;
        return;
      }
      const z = Math.floor(map.getZoom());
      const b = map.getBounds();
      const view = z < 3 ? WORLD : { w: b.getWest(), s: b.getSouth(), e: b.getEast(), n: b.getNorth() };
      const l = loaded;
      if (l && l.from <= t && t < l.next && l.band === band(z) && covers(l.box, view)) return;
      if (Date.now() < retryAt) return;
      // Half a view of margin each way, so a small pan doesn't refetch.
      const padX = z < 3 ? 0 : (view.e - view.w) / 2;
      const padY = z < 3 ? 0 : (view.n - view.s) / 2;
      const box = z < 3 ? WORLD : { w: Math.floor(view.w - padX), s: Math.max(-90, Math.floor(view.s - padY)), e: Math.ceil(view.e + padX), n: Math.min(90, Math.ceil(view.n + padY)) };
      const next: Loaded = { from: w.from, next: w.next, band: band(z), box };
      loaded = next;
      const mine = ++generation;
      const q = new URLSearchParams({ z: String(z), from: String(w.from / 1000), to: String(w.to / 1000), bbox: `${box.w},${box.s},${box.e},${box.n}` });
      fetch(`/api/replay/history/features/${CODE}?${q}`)
        .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then((body: GeoJSON.FeatureCollection) => {
          if (mine !== generation || !shown) return;
          for (const f of body.features) {
            const p = f.properties as WorldBorderFeature & { label?: number; color?: string };
            if (!p.label) p.color = powerColor(p.subject ?? p.name);
          }
          setData(body);
        })
        .catch(() => {
          if (mine !== generation) return;
          loaded = null;
          retryAt = Date.now() + RETRY_MS;
          // A paused clock on a still map would never ask again.
          clearTimeout(retry);
          retry = setTimeout(schedule, RETRY_MS);
        });
    };

    const tick = (force = false) => {
      timer = undefined;
      if (!shown) return;
      const t = history.clock.time();
      load(t);
      // Every shape starts and ends on a new year, so the filter only moves when the year does.
      const from = borderWindow(t) ? yearStart(clockYear(t)) : -Infinity;
      if (!force && from === appliedFrom) return;
      appliedFrom = from;
      const when = at(from / 1000);
      map.setFilter(FILL, ['all', isShape, when] as never);
      map.setFilter(LINE, ['all', isShape, when] as never);
      map.setFilter(LABELS, ['all', ['has', 'label'], when] as never);
    };
    const schedule = () => { timer ??= setTimeout(() => tick(), FRAME_MS); };

    const onClick = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      // An event mark over the country opens its own popup.
      const events = ['history-events', 'history-cells'].filter(l => map.getLayer(l));
      if (!f || (events.length && map.queryRenderedFeatures(e.point, { layers: events }).length)) return;
      openWorldBorderPopup(map, popupRef, f.properties as unknown as WorldBorderFeature, e.lngLat);
    };
    const pointer = () => { map.getCanvas().style.cursor = 'pointer'; };
    const unpointer = () => { map.getCanvas().style.cursor = ''; };

    const hide = () => {
      if (!shown) return;
      shown = false;
      loaded = null;
      generation++;
      map.off('click', FILL, onClick);
      map.off('mouseenter', FILL, pointer);
      map.off('mouseleave', FILL, unpointer);
      removeLayers(map);
      unhide?.();
      unhide = null;
    };

    const sync = () => {
      const want = history.layers().includes(CODE);
      if (!want) return hide();
      if (shown) return;
      shown = true;
      addLayers(map);
      map.on('click', FILL, onClick);
      map.on('mouseenter', FILL, pointer);
      map.on('mouseleave', FILL, unpointer);
      unhide = hideModernBorders(map);
      tick(true);
    };

    const unsession = history.subscribe(sync);
    const unclock = history.clock.subscribe(schedule);
    map.on('moveend', schedule);
    sync();

    return () => {
      clearTimeout(timer);
      clearTimeout(retry);
      unsession();
      unclock();
      try {
        map.off('moveend', schedule);
        hide();
      } catch {
        // The map itself was removed (a theme change remounts it), taking its layers with it.
      }
    };
  }, [mapRef, mapReady, history, popupRef]);
}
