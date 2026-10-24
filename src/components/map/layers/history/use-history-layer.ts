'use client';

import { type RefObject, useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import { activeLocale } from '@/lib/core/i18n/active';
import { HISTORY_FALLBACK_COLOR, HISTORY_FAMILIES, type HistoryDetail, type HistoryFeature } from '@/lib/history/popup';
import { LABEL_SIZE, MAP_INK, labelPaint } from '@/lib/map/style/tokens';
import type { ReplayClock } from '@/lib/map/replay/clock';
import type { MapRef } from '@/components/map/types';
import { openHistoryPopup } from './history-popup';

/*
 * Curated history at the timeline's time: wars, battles, claims, attacks, heritage in danger in History,
 * recorded quakes in Replay.
 * One fetch per view and time bucket from /api/replay/history; the clock only moves the layer filter.
 */

const SOURCE = 'history';
const LAYERS = ['history-lines', 'history-cells', 'history-events', 'history-labels', 'history-cell-counts'];
const EVENT_MARKS = ['history-events', 'history-labels'];
const CLICKABLE = ['history-cells', ...EVENT_MARKS];
const FRAME_MS = 125;
const DAY_S = 86_400;
const YEAR_S = 365.2425 * DAY_S;
/** While playing, an event stays on the map about this long in wall time after it ends. */
const LINGER_WALL_S = 3;
const MAX_HOLD_S = 50 * YEAR_S;
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

type Loaded = { from: number; to: number; z: number; w: number; s: number; e: number; n: number; families: string; kinds: string };

const familyColor = ['match', ['get', 'family'], ...Object.entries(HISTORY_FAMILIES).flatMap(([f, v]) => [f, v.color]), HISTORY_FALLBACK_COLOR];
const coarse = ['>=', ['get', 'geoPrec'], 4];
/** Not a track: a circle layer would dot every vertex of one. */
const mark = ['!', ['has', 'line']];

/** How long an ended event stays drawn: a day when slow, a few seconds of playback when fast. */
const holdFor = (speed: number) => Math.min(MAX_HOLD_S, Math.max(DAY_S, speed * LINGER_WALL_S));

const inTime = (t: number, hold: number) => ['all', ['<=', ['get', 't0'], t], ['>', ['get', 't1'], t - hold]];
/** 1 while the event lasts, fading over the hold once it has ended. */
const fade = (t: number, hold: number) => ['interpolate', ['linear'], ['-', t, ['get', 't1']], 0, 1, hold, 0.25];

function addLayers(map: maplibregl.Map) {
  if (!map.getSource(SOURCE)) map.addSource(SOURCE, { type: 'geojson', data: EMPTY });
  const add = (layer: Parameters<maplibregl.Map['addLayer']>[0]) => { if (!map.getLayer(layer.id)) map.addLayer(layer); };
  // First, so the tracks run under every mark.
  add({ id: 'history-lines', type: 'line', source: SOURCE, filter: ['has', 'line'], layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: {
    'line-color': familyColor as never,
    'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.75, 6, 1.25, 10, 2],
    'line-opacity': 0.5,
  } });
  // A cell is the server's cluster of events: a quiet bubble with its count, like the camera clusters.
  add({ id: 'history-cells', type: 'circle', source: SOURCE, filter: ['has', 'cell'], paint: {
    'circle-color': MAP_INK.surface1,
    'circle-radius': ['interpolate', ['linear'], ['sqrt', ['get', 'n']], 1, 6, 30, 20],
    'circle-opacity': 0.88,
    'circle-stroke-color': familyColor as never,
    'circle-stroke-width': 1,
  } });
  // Quakes by Richter magnitude; the rest by deaths or trade value, which span orders of magnitude.
  const size = ['match', ['get', 'family'],
    'hazard', ['interpolate', ['linear'], ['coalesce', ['get', 'magnitude'], 2.5], 2.5, 2.5, 9, 12],
    ['interpolate', ['linear'], ['ln', ['max', 1, ['coalesce', ['get', 'magnitude'], 1]]], 0, 3, 14, 10]];
  add({ id: 'history-events', type: 'circle', source: SOURCE, filter: ['all', ['!', ['has', 'cell']], mark] as never, paint: {
    'circle-color': familyColor as never,
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, ['*', 0.75, size], 8, ['*', 1.25, size]] as never,
    'circle-opacity': 0.85,
    // Hollow: the source gave no coordinates, so the mark stands for a country or region.
    'circle-stroke-color': ['case', coarse, familyColor, MAP_INK.surface0] as never,
    'circle-stroke-width': ['case', coarse, 1.25, 1] as never,
  } });
  add({ id: 'history-labels', type: 'symbol', source: SOURCE, minzoom: 3, filter: ['all', ['!', ['has', 'cell']], mark, ['==', ['get', 'family'], 'conflict']] as never, layout: {
    'text-field': ['get', 'title'],
    'text-font': ['Noto Sans Regular'],
    'text-size': LABEL_SIZE,
    'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
    'text-radial-offset': 0.8,
    'text-justify': 'auto',
    'text-max-width': 11,
    'symbol-sort-key': ['-', 0, ['coalesce', ['get', 'magnitude'], 0]],
  }, paint: labelPaint() });
  add({ id: 'history-cell-counts', type: 'symbol', source: SOURCE, filter: ['all', ['has', 'cell'], ['>=', ['get', 'n'], 2]], layout: {
    'text-field': ['to-string', ['get', 'n']],
    'text-font': ['Noto Sans Bold'],
    'text-size': LABEL_SIZE,
    'text-allow-overlap': true,
    'text-ignore-placement': true,
  }, paint: { 'text-color': MAP_INK.ink1 } });
}

function removeLayers(map: maplibregl.Map) {
  for (const id of LAYERS) if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(SOURCE)) map.removeSource(SOURCE);
}

function applyTime(map: maplibregl.Map, t: number, hold: number) {
  const when = inTime(t, hold);
  const f = fade(t, hold);
  map.setFilter('history-lines', ['all', ['has', 'line'], when] as never);
  map.setFilter('history-cells', ['all', ['has', 'cell'], when] as never);
  map.setFilter('history-events', ['all', ['!', ['has', 'cell']], mark, when] as never);
  map.setFilter('history-labels', ['all', ['!', ['has', 'cell']], mark, ['==', ['get', 'family'], 'conflict'], when] as never);
  map.setFilter('history-cell-counts', ['all', ['has', 'cell'], ['>=', ['get', 'n'], 2], when] as never);
  map.setPaintProperty('history-lines', 'line-opacity', ['*', 0.5, f] as never);
  map.setPaintProperty('history-cells', 'circle-opacity', ['*', 0.88, f] as never);
  map.setPaintProperty('history-cells', 'circle-stroke-opacity', f as never);
  map.setPaintProperty('history-events', 'circle-opacity', ['*', ['case', coarse, 0.12, 0.85], f] as never);
  map.setPaintProperty('history-events', 'circle-stroke-opacity', f as never);
  map.setPaintProperty('history-labels', 'text-opacity', f as never);
  map.setPaintProperty('history-cell-counts', 'text-opacity', f as never);
}

export function useHistoryLayer({ mapRef, mapReady, timeline, families, kinds, popupRef }: {
  mapRef: MapRef;
  mapReady: boolean;
  /** History's clock, or Replay's for quakes; null draws nothing. */
  timeline: { clock: ReplayClock } | null;
  /** The event families to draw; empty draws none. */
  families: readonly string[];
  /** Only these kinds of them; empty draws every kind. */
  kinds: readonly string[];
  popupRef: RefObject<maplibregl.Popup | null>;
}) {
  const familiesRef = useRef(families);
  const kindsRef = useRef(kinds);
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
      const kindKey = kindsRef.current.join(',');
      // No families means nothing to draw, not all of them.
      if (!familyKey) {
        if (loaded) (map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(EMPTY);
        loaded = null;
        generation++;
        return;
      }
      const inside = loaded && loaded.z === z && loaded.families === familyKey && loaded.kinds === kindKey && loaded.from <= lo && hi < loaded.to
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
        kinds: kindKey,
      };
      loaded = next;
      const mine = ++generation;
      const url = `/api/replay/history/events?bbox=${next.w},${next.s},${next.e},${next.n}&from=${Math.round(next.from)}&to=${Math.round(next.to)}&z=${z}&families=${familyKey}${kindKey ? `&kinds=${kindKey}` : ''}&lang=${activeLocale()}`;
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
      // Past today only projected country values stand; no event happens there.
      if (t * 1000 > Date.now()) {
        if (loaded) (map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(EMPTY);
        loaded = null;
        generation++;
        return;
      }
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
      openHistoryPopup(map, popupRef, f.properties as HistoryFeature, (f.geometry as GeoJSON.Point).coordinates as [number, number]);
    };
    // Dev-only handle: tools/shorts opens an event's card by id, as a tap would, though the event sits inside a cluster.
    if (process.env.NODE_ENV === 'development') {
      Object.assign(window, {
        __takipOpenEvent: (id: number) => void fetch(`/api/replay/history/events/${id}`)
          .then(res => (res.ok ? (res.json() as Promise<HistoryDetail>) : null))
          .then(r => { if (r && typeof r.lon === 'number' && typeof r.lat === 'number') openHistoryPopup(map, popupRef, r, [r.lon, r.lat], r); }),
      });
    }
    const onCellClick = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: Math.min(map.getZoom() + 2, 12) });
    };
    const pointer = () => { map.getCanvas().style.cursor = 'pointer'; };
    const unpointer = () => { map.getCanvas().style.cursor = ''; };

    map.on('click', EVENT_MARKS, onEventClick);
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
        map.off('click', EVENT_MARKS, onEventClick);
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
    kindsRef.current = kinds;
    reloadRef.current();
  }, [families, kinds]);
}
