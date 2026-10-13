'use client';

import { type RefObject, useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import { HISTORY_FALLBACK_COLOR, HISTORY_FAMILIES, type HistoryDetail, type HistoryFeature, historyPopupHtml } from '@/lib/history-popup';
import type { ReplayClock } from '@/lib/replay/clock';
import type { MapRef } from './types';

/*
 * Curated history at the timeline's time: wars, battles, claims, attacks, heritage in danger in History,
 * recorded quakes in Replay.
 * One fetch per view and time bucket from /api/replay/history; the clock only moves the layer filter.
 */

const SOURCE = 'history';
const LAYERS = ['history-cells', 'history-events', 'history-labels', 'history-cell-counts'];
const CLICKABLE = ['history-cells', 'history-events'];
const FRAME_MS = 125;
const DAY_S = 86_400;
const YEAR_S = 365.2425 * DAY_S;
/** While playing, an event stays on the map about this long in wall time after it ends. */
const LINGER_WALL_S = 3;
const MAX_HOLD_S = 50 * YEAR_S;
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

type Loaded = { from: number; to: number; z: number; w: number; s: number; e: number; n: number; families: string };

const familyColor = ['match', ['get', 'family'], ...Object.entries(HISTORY_FAMILIES).flatMap(([f, v]) => [f, v.color]), HISTORY_FALLBACK_COLOR];
const coarse = ['>=', ['get', 'geoPrec'], 4];

/** How long an ended event stays drawn: a day when slow, a few seconds of playback when fast. */
const holdFor = (speed: number) => Math.min(MAX_HOLD_S, Math.max(DAY_S, speed * LINGER_WALL_S));

const inTime = (t: number, hold: number) => ['all', ['<=', ['get', 't0'], t], ['>', ['get', 't1'], t - hold]];
/** 1 while the event lasts, fading over the hold once it has ended. */
const fade = (t: number, hold: number) => ['interpolate', ['linear'], ['-', t, ['get', 't1']], 0, 1, hold, 0.25];

function addLayers(map: maplibregl.Map) {
  if (!map.getSource(SOURCE)) map.addSource(SOURCE, { type: 'geojson', data: EMPTY });
  const add = (layer: Parameters<maplibregl.Map['addLayer']>[0]) => { if (!map.getLayer(layer.id)) map.addLayer(layer); };
  add({ id: 'history-cells', type: 'circle', source: SOURCE, filter: ['has', 'cell'], paint: {
    'circle-color': familyColor as never,
    'circle-radius': ['interpolate', ['linear'], ['sqrt', ['get', 'n']], 1, 4, 30, 26],
    'circle-opacity': 0.3,
    'circle-stroke-color': familyColor as never,
    'circle-stroke-width': 1,
  } });
  // Quakes by Richter magnitude; the rest by deaths or trade value, which span orders of magnitude.
  const size = ['match', ['get', 'family'],
    'hazard', ['interpolate', ['linear'], ['coalesce', ['get', 'magnitude'], 2.5], 2.5, 2.5, 9, 16],
    ['interpolate', ['linear'], ['ln', ['max', 1, ['coalesce', ['get', 'magnitude'], 1]]], 0, 3.5, 14, 13]];
  add({ id: 'history-events', type: 'circle', source: SOURCE, filter: ['!', ['has', 'cell']], paint: {
    'circle-color': familyColor as never,
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, ['*', 0.8, size], 8, ['*', 1.4, size]] as never,
    'circle-opacity': 0.85,
    // Hollow: the source gave no coordinates, so the mark stands for a country or region.
    'circle-stroke-color': familyColor as never,
    'circle-stroke-width': ['case', coarse, 1.5, 0.6] as never,
  } });
  add({ id: 'history-labels', type: 'symbol', source: SOURCE, minzoom: 3, filter: ['all', ['!', ['has', 'cell']], ['==', ['get', 'family'], 'conflict']], layout: {
    'text-field': ['get', 'title'],
    'text-font': ['Open Sans Regular'],
    'text-size': 10,
    'text-anchor': 'top',
    'text-offset': [0, 0.9],
    'text-max-width': 12,
    'symbol-sort-key': ['-', 0, ['coalesce', ['get', 'magnitude'], 0]],
  }, paint: { 'text-color': familyColor as never, 'text-halo-color': '#000', 'text-halo-width': 1 } });
  add({ id: 'history-cell-counts', type: 'symbol', source: SOURCE, filter: ['all', ['has', 'cell'], ['>=', ['get', 'n'], 10]], layout: {
    'text-field': ['to-string', ['get', 'n']],
    'text-font': ['Open Sans Regular'],
    'text-size': 9,
    'text-allow-overlap': false,
  }, paint: { 'text-color': '#E8E6E0', 'text-halo-color': '#000', 'text-halo-width': 1 } });
}

function removeLayers(map: maplibregl.Map) {
  for (const id of LAYERS) if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(SOURCE)) map.removeSource(SOURCE);
}

function applyTime(map: maplibregl.Map, t: number, hold: number) {
  const when = inTime(t, hold);
  const f = fade(t, hold);
  map.setFilter('history-cells', ['all', ['has', 'cell'], when] as never);
  map.setFilter('history-events', ['all', ['!', ['has', 'cell']], when] as never);
  map.setFilter('history-labels', ['all', ['!', ['has', 'cell']], ['==', ['get', 'family'], 'conflict'], when] as never);
  map.setFilter('history-cell-counts', ['all', ['has', 'cell'], ['>=', ['get', 'n'], 10], when] as never);
  map.setPaintProperty('history-cells', 'circle-opacity', ['*', 0.3, f] as never);
  map.setPaintProperty('history-cells', 'circle-stroke-opacity', f as never);
  map.setPaintProperty('history-events', 'circle-opacity', ['*', ['case', coarse, 0.12, 0.85], f] as never);
  map.setPaintProperty('history-events', 'circle-stroke-opacity', f as never);
  map.setPaintProperty('history-labels', 'text-opacity', f as never);
}

export function useHistoryLayer({ mapRef, mapReady, timeline, families, popupRef }: {
  mapRef: MapRef;
  mapReady: boolean;
  /** History's clock, or Replay's for quakes; null draws nothing. */
  timeline: { clock: ReplayClock } | null;
  /** The event families to draw; empty draws none. */
  families: readonly string[];
  popupRef: RefObject<maplibregl.Popup | null>;
}) {
  const familiesRef = useRef(families);
  const reloadRef = useRef<() => void>(() => {});

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !timeline) return;
    addLayers(map);

    let loaded: Loaded | null = null;
    let generation = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retryAt = 0;
    let applied = { t: NaN, hold: NaN };

    const load = (t: number, hold: number) => {
      if (Date.now() < retryAt) return;
      const z = Math.floor(map.getZoom());
      // One request per view per bucket; the server splits it into 10 bins, so a cell counts about a tenth of it.
      const bucket = Math.min(10 * YEAR_S, Math.max(YEAR_S, hold * 20));
      const ahead = timeline.clock.playing() ? timeline.clock.speed() * 10 : 0;
      const lo = t - hold;
      const hi = t + ahead;
      const b = map.getBounds();
      const view = z < 3 ? { w: -180, s: -90, e: 180, n: 90 } : { w: b.getWest(), s: b.getSouth(), e: b.getEast(), n: b.getNorth() };
      const familyKey = familiesRef.current.join(',');
      // No families means nothing to draw, not all of them.
      if (!familyKey) {
        if (loaded) (map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(EMPTY);
        loaded = null;
        generation++;
        return;
      }
      const inside = loaded && loaded.z === z && loaded.families === familyKey && loaded.from <= lo && hi < loaded.to
        && loaded.w <= view.w && loaded.e >= view.e && loaded.s <= view.s && loaded.n >= view.n;
      if (inside) return;
      const padX = z < 3 ? 0 : (view.e - view.w) / 2;
      const padY = z < 3 ? 0 : (view.n - view.s) / 2;
      const next: Loaded = {
        from: Math.floor(lo / bucket) * bucket,
        to: (Math.floor(hi / bucket) + 1) * bucket,
        z,
        w: Math.floor(view.w - padX),
        s: Math.max(-90, Math.floor(view.s - padY)),
        e: Math.ceil(view.e + padX),
        n: Math.min(90, Math.ceil(view.n + padY)),
        families: familyKey,
      };
      loaded = next;
      const mine = ++generation;
      const url = `/api/replay/history/events?bbox=${next.w},${next.s},${next.e},${next.n}&from=${Math.round(next.from)}&to=${Math.round(next.to)}&z=${z}&families=${familyKey}`;
      fetch(url).then(async res => {
        if (mine !== generation) return;
        if (res.status === 429) {
          retryAt = Date.now() + Number(res.headers.get('Retry-After') ?? 5) * 1000;
          loaded = null;
          return;
        }
        if (!res.ok) {
          retryAt = Date.now() + 10_000;
          loaded = null;
          return;
        }
        const body = (await res.json()) as GeoJSON.FeatureCollection;
        if (mine !== generation) return;
        (map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(body);
      }).catch(() => {
        if (mine !== generation) return;
        retryAt = Date.now() + 10_000;
        loaded = null;
      });
    };

    const tick = () => {
      timer = undefined;
      const t = timeline.clock.time() / 1000;
      const hold = holdFor(timeline.clock.speed());
      load(t, hold);
      // Filters only need to move when the time has moved a tenth of the hold.
      if (Math.abs(t - applied.t) < hold / 10 && hold === applied.hold) return;
      applied = { t, hold };
      applyTime(map, t, hold);
    };
    const schedule = () => { timer ??= setTimeout(tick, FRAME_MS); };

    const onEventClick = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties as HistoryFeature;
      const at = (f.geometry as GeoJSON.Point).coordinates as [number, number];
      popupRef.current?.remove();
      const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '340px', offset: 12 }).setLngLat(at).setHTML(historyPopupHtml(p)).addTo(map);
      popupRef.current = popup;
      fetch(`/api/replay/history/events/${p.id}`)
        .then(res => (res.ok ? (res.json() as Promise<HistoryDetail>) : null))
        .catch(() => null)
        .then(d => { if (popupRef.current === popup) popup.setHTML(historyPopupHtml(p, d)); });
    };
    const onCellClick = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: Math.min(map.getZoom() + 2, 12) });
    };
    const pointer = () => { map.getCanvas().style.cursor = 'pointer'; };
    const unpointer = () => { map.getCanvas().style.cursor = ''; };

    map.on('click', 'history-events', onEventClick);
    map.on('click', 'history-cells', onCellClick);
    for (const id of CLICKABLE) {
      map.on('mouseenter', id, pointer);
      map.on('mouseleave', id, unpointer);
    }
    map.on('moveend', schedule);
    const unclock = timeline.clock.subscribe(schedule);
    reloadRef.current = tick;
    tick();

    return () => {
      generation++;
      clearTimeout(timer);
      unclock();
      reloadRef.current = () => {};
      try {
        map.off('moveend', schedule);
        map.off('click', 'history-events', onEventClick);
        map.off('click', 'history-cells', onCellClick);
        for (const id of CLICKABLE) {
          map.off('mouseenter', id, pointer);
          map.off('mouseleave', id, unpointer);
        }
        removeLayers(map);
      } catch {
        // The map itself was removed (a theme change remounts it), taking its layers with it.
      }
    };
  }, [mapRef, mapReady, timeline, popupRef]);

  useEffect(() => {
    familiesRef.current = families;
    reloadRef.current();
  }, [families]);
}
