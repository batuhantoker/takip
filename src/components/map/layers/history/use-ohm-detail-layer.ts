'use client';

import { useEffect } from 'react';
import type * as maplibregl from 'maplibre-gl';
import type { HistorySession } from '@/lib/history/session';
import { aliveAt, decimalYear, OHM_ATTRIBUTION, OHM_MIN_ZOOM, OHM_TILES, ohmLevels } from '@/lib/history/ohm';
import { WORLD_BORDERS } from '@/lib/history/world-borders';
import { MAP_INK, labelPaint } from '@/lib/map/style/tokens';
import type { MapRef } from '@/components/map/types';

const SOURCE = 'ohm';
const STATES = 'ohm-borders-states';
const REGIONS = 'ohm-borders-regions';
const LABELS = 'ohm-labels';
/** Each filter change re-reads the visible tiles, so the clock moves it a month at a time. */
const STEP = 1 / 12;
const MIN_GAP_MS = 250;

const STATE_LINES = ohmLevels(2, 2);
const REGION_LINES = ohmLevels(3, 4);

function addLayers(map: maplibregl.Map, d: number) {
  if (!map.getSource(SOURCE)) {
    map.addSource(SOURCE, { type: 'vector', tiles: [OHM_TILES], minzoom: OHM_MIN_ZOOM, maxzoom: 14, attribution: OHM_ATTRIBUTION });
  }
  const before = map.getStyle().layers?.find(l => l.type === 'symbol')?.id;
  const alive = aliveAt(d);
  if (!map.getLayer(REGIONS)) map.addLayer({
    id: REGIONS, type: 'line', source: SOURCE, 'source-layer': 'land_ohm_lines', minzoom: OHM_MIN_ZOOM,
    filter: ['all', REGION_LINES, alive],
    paint: { 'line-color': MAP_INK.ink2, 'line-opacity': 0.6, 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.8, 12, 1.4], 'line-dasharray': [2, 1.5] },
  }, before);
  if (!map.getLayer(STATES)) map.addLayer({
    id: STATES, type: 'line', source: SOURCE, 'source-layer': 'land_ohm_lines', minzoom: OHM_MIN_ZOOM,
    filter: ['all', STATE_LINES, alive],
    paint: { 'line-color': MAP_INK.ink1, 'line-opacity': 0.7, 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1.2, 12, 2.2] },
  }, before);
  // States are named by Cliopatria's labels; these name what lies inside them.
  if (!map.getLayer(LABELS)) map.addLayer({
    id: LABELS, type: 'symbol', source: SOURCE, 'source-layer': 'land_ohm_centroids', minzoom: OHM_MIN_ZOOM + 1,
    filter: ['all', REGION_LINES, alive],
    layout: {
      'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']],
      'text-font': ['Noto Sans Italic'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 8, 10, 12, 12],
      'text-max-width': 8,
      'symbol-sort-key': ['-', 0, ['coalesce', ['get', 'area'], 0]],
    },
    paint: labelPaint(MAP_INK.ink2),
  });
}

function removeLayers(map: maplibregl.Map) {
  for (const id of [LABELS, STATES, REGIONS]) if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(SOURCE)) map.removeSource(SOURCE);
}

/** OpenHistoricalMap's dated borders under the world borders from OHM_MIN_ZOOM (lib/history/ohm). */
export function useOhmDetailLayer({ mapRef, mapReady, history }: { mapRef: MapRef; mapReady: boolean; history: HistorySession | null }) {
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !history) return;
    let shown = false;
    let applied = NaN;
    let last = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const month = () => Math.floor(decimalYear(history.clock.time()) / STEP) * STEP + STEP / 2;

    const apply = () => {
      timer = undefined;
      if (!shown) return;
      const d = month();
      if (d === applied) return;
      applied = d;
      last = Date.now();
      const alive = aliveAt(d);
      map.setFilter(REGIONS, ['all', REGION_LINES, alive]);
      map.setFilter(STATES, ['all', STATE_LINES, alive]);
      map.setFilter(LABELS, ['all', REGION_LINES, alive]);
    };
    const schedule = () => { timer ??= setTimeout(apply, Math.max(0, MIN_GAP_MS - (Date.now() - last))); };

    const sync = () => {
      const want = history.layers().includes(WORLD_BORDERS.code);
      if (want === shown) return;
      shown = want;
      if (!want) {
        removeLayers(map);
        return;
      }
      applied = month();
      addLayers(map, applied);
    };

    const unsession = history.subscribe(sync);
    const unclock = history.clock.subscribe(schedule);
    sync();
    return () => {
      clearTimeout(timer);
      unsession();
      unclock();
      try {
        removeLayers(map);
      } catch {
        // The map itself was removed, taking its layers with it.
      }
    };
  }, [mapRef, mapReady, history]);
}
