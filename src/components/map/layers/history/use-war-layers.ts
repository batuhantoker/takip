'use client';

import { type RefObject, useEffect } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { HistorySession } from '@/lib/history/session';
import { ALIGNMENTS, type WarFeature, warPopupHtml } from '@/lib/history/war-layers';
import { MAP_INK, labelPaint } from '@/lib/map/tokens';
import { hatchImage } from '@/lib/map/hatch';
import type { MapRef } from '@/components/map/types';

/*
 * Wartime borders in History: each polity's shape for the month at the clock, coloured by alignment.
 * One fetch per two-year window and zoom band from /api/replay/history/features; the clock only moves the filter.
 */

const FRAME_MS = 125;
const YEAR_S = 365.2425 * 86_400;
const HATCH = 'war-occupied-hatch';
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const FOREVER_S = 8.64e12;

/** Zoom bands of the feature index (generalize.ts ZBANDS): a new band means another simplification. */
const band = (z: number) => (z <= 2 ? 0 : z <= 4 ? 1 : z <= 6 ? 2 : z <= 9 ? 3 : 4);

const ids = (code: string) => ({ source: `war-${code}`, fill: `war-${code}-fill`, hatch: `war-${code}-hatch`, line: `war-${code}-line`, labels: `war-${code}-labels` });

const color = ['match', ['get', 'alignment'], ...ALIGNMENTS.flatMap(a => [a.key, a.color]), ALIGNMENTS[ALIGNMENTS.length - 1].color];
const isShape = ['!', ['has', 'label']];
const at = (t: number) => ['all', ['<=', ['get', 't0'], t], ['>', ['coalesce', ['get', 't1'], FOREVER_S], t]];
/** Today's country names and borders would contradict the period's; they step aside while borders show. */
const MODERN = ['place_country_1', 'place_country_2', 'boundary_country_outline', 'boundary_country_inner'];

function addLayers(map: maplibregl.Map, code: string) {
  const id = ids(code);
  if (!map.hasImage(HATCH)) map.addImage(HATCH, hatchImage([201, 98, 92, 190]));
  if (!map.getSource(id.source)) map.addSource(id.source, { type: 'geojson', data: EMPTY });
  // Under the basemap's labels, like the country colouring; the events layer stays above.
  const before = map.getStyle().layers?.find(l => l.type === 'symbol')?.id;
  if (!map.getLayer(id.fill)) map.addLayer({ id: id.fill, type: 'fill', source: id.source, filter: isShape as never, paint: {
    'fill-color': color as never,
    'fill-opacity': 0.46,
  } }, before);
  if (!map.getLayer(id.hatch)) map.addLayer({ id: id.hatch, type: 'fill', source: id.source, filter: ['all', isShape, ['==', ['get', 'alignment'], 'occupied']] as never, paint: {
    'fill-pattern': HATCH,
  } }, before);
  if (!map.getLayer(id.line)) map.addLayer({ id: id.line, type: 'line', source: id.source, filter: isShape as never, paint: {
    'line-color': MAP_INK.ink2,
    'line-opacity': 0.4,
    'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.4, 6, 1] as never,
  } }, before);
  if (!map.getLayer(id.labels)) map.addLayer({ id: id.labels, type: 'symbol', source: id.source, minzoom: 3, filter: ['has', 'label'] as never, layout: {
    'text-field': ['get', 'name'],
    'text-font': ['Noto Sans Regular'],
    'text-size': ['interpolate', ['linear'], ['zoom'], 3, 11, 6, 13] as never,
    'text-max-width': 8,
    'text-allow-overlap': false,
  }, paint: labelPaint(MAP_INK.ink1) });
}

function removeLayers(map: maplibregl.Map, code: string) {
  const id = ids(code);
  for (const l of [id.labels, id.line, id.hatch, id.fill]) if (map.getLayer(l)) map.removeLayer(l);
  if (map.getSource(id.source)) map.removeSource(id.source);
}

type Loaded = { from: number; to: number; band: number; attribution: string | null };

export function useWarLayers({ mapRef, mapReady, history, popupRef }: {
  mapRef: MapRef;
  mapReady: boolean;
  history: HistorySession | null;
  popupRef: RefObject<maplibregl.Popup | null>;
}) {
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !history) return;
    const shown = new Map<string, { loaded: Loaded | null; generation: number }>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Only the ones this hook hid, so it never unhides what something else (paleo, a style) turned off.
    let muted: string[] = [];
    const muteModern = (on: boolean) => {
      if (on && !muted.length) {
        muted = MODERN.filter(id => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none');
        for (const id of muted) map.setLayoutProperty(id, 'visibility', 'none');
      } else if (!on && muted.length) {
        for (const id of muted) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
        muted = [];
      }
    };
    let appliedT = NaN;

    const load = (code: string, t: number) => {
      const state = shown.get(code)!;
      const b = band(Math.floor(map.getZoom()));
      const l = state.loaded;
      if (l && l.band === b && l.from <= t && t < l.to - YEAR_S / 4) return;
      const from = Math.floor(t / YEAR_S) * YEAR_S;
      const next: Loaded = { from, to: from + 2 * YEAR_S, band: b, attribution: l?.attribution ?? null };
      state.loaded = next;
      const mine = ++state.generation;
      fetch(`/api/replay/history/features/${code}?z=${Math.floor(map.getZoom())}&from=${Math.round(next.from)}&to=${Math.round(next.to)}`)
        .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then((body: GeoJSON.FeatureCollection & { source?: { attribution: string | null; name: string } }) => {
          if (mine !== state.generation || !shown.has(code)) return;
          next.attribution = body.source?.attribution ?? body.source?.name ?? null;
          (map.getSource(ids(code).source) as maplibregl.GeoJSONSource | undefined)?.setData(body);
        })
        .catch(() => { if (mine === state.generation) state.loaded = null; });
    };

    const applyTime = (code: string, t: number) => {
      const id = ids(code);
      const when = at(t);
      map.setFilter(id.fill, ['all', isShape, when] as never);
      map.setFilter(id.hatch, ['all', isShape, ['==', ['get', 'alignment'], 'occupied'], when] as never);
      map.setFilter(id.line, ['all', isShape, when] as never);
      map.setFilter(id.labels, ['all', ['has', 'label'], when] as never);
    };

    const tick = (force = false) => {
      timer = undefined;
      const t = history.clock.time() / 1000;
      for (const code of shown.keys()) load(code, t);
      // Borders change at month ends; a day's movement needs no new filter.
      if (!force && Math.abs(t - appliedT) < 86_400) return;
      appliedT = t;
      for (const code of shown.keys()) applyTime(code, t);
    };
    const schedule = () => { timer ??= setTimeout(() => tick(), FRAME_MS); };

    const onClick = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      // An event mark over the country opens its own popup.
      const events = ['history-events', 'history-cells'].filter(l => map.getLayer(l));
      if (!f || (events.length && map.queryRenderedFeatures(e.point, { layers: events }).length)) return;
      const code = [...shown.keys()].find(c => f.layer.id === ids(c).fill);
      const attribution = code ? shown.get(code)?.loaded?.attribution ?? null : null;
      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '320px', offset: 8 })
        .setLngLat(e.lngLat).setHTML(warPopupHtml(f.properties as unknown as WarFeature, attribution)).addTo(map);
    };
    const pointer = () => { map.getCanvas().style.cursor = 'pointer'; };
    const unpointer = () => { map.getCanvas().style.cursor = ''; };

    const sync = () => {
      const want = new Set(history.layers());
      for (const code of [...shown.keys()]) {
        if (want.has(code)) continue;
        const id = ids(code);
        map.off('click', id.fill, onClick);
        map.off('mouseenter', id.fill, pointer);
        map.off('mouseleave', id.fill, unpointer);
        removeLayers(map, code);
        shown.delete(code);
      }
      for (const code of want) {
        if (shown.has(code)) continue;
        addLayers(map, code);
        const id = ids(code);
        map.on('click', id.fill, onClick);
        map.on('mouseenter', id.fill, pointer);
        map.on('mouseleave', id.fill, unpointer);
        shown.set(code, { loaded: null, generation: 0 });
      }
      muteModern(shown.size > 0);
      tick(true);
    };

    const unsession = history.subscribe(sync);
    const unclock = history.clock.subscribe(schedule);
    map.on('moveend', schedule);
    sync();

    return () => {
      clearTimeout(timer);
      unsession();
      unclock();
      try {
        map.off('moveend', schedule);
        for (const code of [...shown.keys()]) {
          const id = ids(code);
          map.off('click', id.fill, onClick);
          map.off('mouseenter', id.fill, pointer);
          map.off('mouseleave', id.fill, unpointer);
          removeLayers(map, code);
        }
        muteModern(false);
      } catch {
        // The map itself was removed (a theme change remounts it), taking its layers with it.
      }
    };
  }, [mapRef, mapReady, history, popupRef]);
}
