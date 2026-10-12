'use client';

import { useEffect } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { rampFor, readingAt, type SeriesPayload, yearAt } from '@/lib/history/series';
import type { HistorySession } from '@/lib/history/session';
import type { MapRef } from './types';

/*
 * History's country colouring: today's shapes coloured by a metric at the clock's year. The series arrives once;
 * the clock only changes feature-state. Countries without a value are hatched: missing is never zero.
 */

const SOURCE = 'history-view';
const NODATA = 'history-view-nodata';
const FILL = 'history-view-fill';
const LINE = 'history-view-line';
const HATCH = 'history-view-hatch';
const LAYERS = [LINE, FILL, NODATA];
const FRAME_MS = 125;
/** Repaint once the clock has moved this many years. */
const STEP_YEARS = 0.02;

const hasValue = ['==', ['typeof', ['feature-state', 't']], 'number'];

/** 45° hairlines on transparent, 8 px repeat. */
function hatch(): { width: number; height: number; data: Uint8Array } {
  const size = 8;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if ((x + y) % size !== 0) continue;
      data.set([138, 135, 127, 150], (y * size + x) * 4);
    }
  }
  return { width: size, height: size, data };
}

/** Under the basemap's labels and every overlay, which all sit above its first symbol layer. */
function beneath(map: maplibregl.Map) {
  return map.getStyle().layers?.find(l => l.type === 'symbol')?.id;
}

function addLayers(map: maplibregl.Map, dark: boolean) {
  if (!map.hasImage(HATCH)) map.addImage(HATCH, hatch());
  if (!map.getSource(SOURCE)) map.addSource(SOURCE, { type: 'geojson', data: '/data/boundaries/countries.json', promoteId: 'id' });
  const before = beneath(map);
  const ramp = rampFor(dark);
  const color = ['interpolate', ['linear'], ['coalesce', ['feature-state', 't'], 0], ...ramp.flatMap((c, i) => [i / (ramp.length - 1), c])];
  if (!map.getLayer(NODATA)) map.addLayer({ id: NODATA, type: 'fill', source: SOURCE, paint: {
    'fill-pattern': HATCH,
    'fill-opacity': ['case', hasValue, 0, 0.7] as never,
  } }, before);
  if (!map.getLayer(FILL)) map.addLayer({ id: FILL, type: 'fill', source: SOURCE, paint: {
    'fill-color': color as never,
    'fill-opacity': ['case', hasValue, 0.72, 0] as never,
  } }, before);
  if (!map.getLayer(LINE)) map.addLayer({ id: LINE, type: 'line', source: SOURCE, paint: {
    'line-color': ['case', ['boolean', ['feature-state', 'hover'], false], '#E8C36A', dark ? 'rgba(232,230,224,0.18)' : 'rgba(20,20,28,0.25)'] as never,
    'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 1.5, 0.5] as never,
  } }, before);
}

function removeLayers(map: maplibregl.Map) {
  for (const id of LAYERS) if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(SOURCE)) map.removeSource(SOURCE);
}

export function useChoroplethLayer({ mapRef, mapReady, history, mapStyle }: {
  mapRef: MapRef;
  mapReady: boolean;
  history: HistorySession | null;
  mapStyle: string;
}) {
  const dark = mapStyle !== 'topo';

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !history) return;
    const view = history.countries;
    view.setDark(dark);
    let shown: SeriesPayload | null = null;
    let painted = new Set<string>();
    let appliedYear = NaN;
    let hoverKey: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const paint = (force = false) => {
      const s = view.state();
      if (s.status !== 'ready') return;
      const y = yearAt(history.clock.time());
      if (!force && Math.abs(y - appliedYear) < STEP_YEARS) return;
      appliedYear = y;
      const next = new Set<string>();
      for (const [key, points] of Object.entries(s.data.values)) {
        const r = readingAt(points, y);
        if (!r) continue;
        next.add(key);
        map.setFeatureState({ source: SOURCE, id: key }, { t: s.scale.norm(r.v) });
      }
      for (const key of painted) if (!next.has(key)) map.removeFeatureState({ source: SOURCE, id: key }, 't');
      painted = next;
      if (hoverKey) hoverAt(hoverKey, view.hovered()?.name ?? hoverKey);
    };

    const hoverAt = (key: string, name: string) => {
      const s = view.state();
      const points = s.status === 'ready' ? s.data.values[key] : undefined;
      view.setHovered({ key, name, reading: points ? readingAt(points, yearAt(history.clock.time())) : null });
    };

    // While the next metric loads, the previous one stays drawn.
    const sync = () => {
      const s = view.state();
      if (s.status === 'off') {
        if (shown) removeLayers(map);
        shown = null;
        painted = new Set();
        return;
      }
      if (s.status !== 'ready' || s.data === shown) return;
      addLayers(map, dark);
      for (const key of painted) map.removeFeatureState({ source: SOURCE, id: key }, 't');
      painted = new Set();
      shown = s.data;
      paint(true);
    };

    const tick = () => {
      timer = undefined;
      paint();
    };
    const schedule = () => { timer ??= setTimeout(tick, FRAME_MS); };

    const onMove = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      const key = typeof f?.id === 'string' ? f.id : null;
      if (!f || !key || key === hoverKey) return;
      if (hoverKey) map.setFeatureState({ source: SOURCE, id: hoverKey }, { hover: false });
      hoverKey = key;
      map.setFeatureState({ source: SOURCE, id: key }, { hover: true });
      hoverAt(key, String(f.properties?.name ?? key));
    };
    const onLeave = () => {
      if (hoverKey && map.getSource(SOURCE)) map.setFeatureState({ source: SOURCE, id: hoverKey }, { hover: false });
      hoverKey = null;
      view.setHovered(null);
    };

    map.on('mousemove', NODATA, onMove);
    map.on('mouseleave', NODATA, onLeave);
    const unview = view.subscribe(sync);
    const unclock = history.clock.subscribe(schedule);
    sync();

    return () => {
      clearTimeout(timer);
      unview();
      unclock();
      view.setHovered(null);
      try {
        map.off('mousemove', NODATA, onMove);
        map.off('mouseleave', NODATA, onLeave);
        removeLayers(map);
      } catch {
        // The map itself was removed (a theme change remounts it), taking its layers with it.
      }
    };
  }, [mapRef, mapReady, history, dark]);
}
