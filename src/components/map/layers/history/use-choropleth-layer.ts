'use client';

import { useEffect } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { countryReading, rampFor, type SeriesPayload, yearAt } from '@/lib/history/series';
import type { HistorySession } from '@/lib/history/session';
import { hatchImage } from '@/lib/map/style/hatch';
import { MAP_INK, SERIES_INK } from '@/lib/map/style/tokens';
import type { MapRef } from '@/components/map/types';

/*
 * History's country colouring: today's shapes coloured by a metric at the clock's year. The series arrives once;
 * the clock only changes feature-state. Countries without a value are hatched: missing is never zero.
 * A projected value is hatched the other way over its colour, so it never passes for a measured one.
 * A click charts a country over time (country-chart.ts); a charted country is outlined in its chart colour.
 */

const SOURCE = 'history-view';
const NODATA = 'history-view-nodata';
const FILL = 'history-view-fill';
const LINE = 'history-view-line';
const HATCH = 'history-view-hatch';
const PROJECTED = 'history-view-projected';
const PROJECTED_HATCH = 'history-view-projected-hatch';
const CHARTED = 'history-view-charted';
const CHARTED_CASING = 'history-view-charted-casing';
const LAYERS = [CHARTED, CHARTED_CASING, LINE, PROJECTED, FILL, NODATA];
/** Events drawn over the countries; a click on one opens its popup instead of charting the country. */
const EVENT_LAYERS = ['history-events', 'history-cells'];
const FRAME_MS = 125;
/** Repaint once the clock has moved this many years: about a week, or a day for a weekly series. */
const STEP_YEARS = 0.02;
const STEP_YEARS_DATED = 0.0027;

const hasValue = ['==', ['typeof', ['feature-state', 't']], 'number'];
const isProjected = ['boolean', ['feature-state', 'p'], false];
const isCharted = ['==', ['typeof', ['feature-state', 'c']], 'number'];
const chartColor = ['match', ['coalesce', ['feature-state', 'c'], -1], ...SERIES_INK.flatMap((c, i) => [i, c]), 'rgba(0,0,0,0)'];
const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

/** Under the basemap's labels and every overlay, which all sit above its first symbol layer. */
function beneath(map: maplibregl.Map) {
  return map.getStyle().layers?.find(l => l.type === 'symbol')?.id;
}

function addLayers(map: maplibregl.Map, dark: boolean) {
  if (!map.hasImage(HATCH)) map.addImage(HATCH, hatchImage([127, 139, 150, 130]));
  if (!map.hasImage(PROJECTED_HATCH)) map.addImage(PROJECTED_HATCH, hatchImage([...rgb(MAP_INK.slate), 210], { flip: true }));
  if (!map.getSource(SOURCE)) map.addSource(SOURCE, { type: 'geojson', data: '/data/boundaries/countries.json', promoteId: 'id' });
  const before = beneath(map);
  const ramp = rampFor(dark);
  const color = ['interpolate', ['linear'], ['coalesce', ['feature-state', 't'], 0], ...ramp.flatMap((c, i) => [i / (ramp.length - 1), c])];
  if (!map.getLayer(NODATA)) map.addLayer({ id: NODATA, type: 'fill', source: SOURCE, paint: {
    'fill-pattern': HATCH,
    'fill-opacity': ['case', hasValue, 0, 0.4] as never,
  } }, before);
  if (!map.getLayer(FILL)) map.addLayer({ id: FILL, type: 'fill', source: SOURCE, paint: {
    'fill-color': color as never,
    'fill-opacity': ['case', hasValue, 0.68, 0] as never,
  } }, before);
  if (!map.getLayer(PROJECTED)) map.addLayer({ id: PROJECTED, type: 'fill', source: SOURCE, paint: {
    'fill-pattern': PROJECTED_HATCH,
    'fill-opacity': ['case', ['all', hasValue, isProjected], 1, 0] as never,
  } }, before);
  if (!map.getLayer(LINE)) map.addLayer({ id: LINE, type: 'line', source: SOURCE, paint: {
    'line-color': ['case', ['boolean', ['feature-state', 'hover'], false], dark ? '#ECEEF0' : '#111317', dark ? 'rgba(255,255,255,0.14)' : 'rgba(17,19,23,0.22)'] as never,
    'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 1.5, 0.5] as never,
  } }, before);
  if (!map.getLayer(CHARTED_CASING)) map.addLayer({ id: CHARTED_CASING, type: 'line', source: SOURCE, paint: {
    'line-color': MAP_INK.surface0,
    'line-width': 4.5,
    'line-opacity': ['case', isCharted, 0.7, 0] as never,
  } }, before);
  if (!map.getLayer(CHARTED)) map.addLayer({ id: CHARTED, type: 'line', source: SOURCE, paint: {
    'line-color': chartColor as never,
    'line-width': 2,
    'line-opacity': ['case', isCharted, 1, 0] as never,
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
    let outlined = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const paint = (force = false) => {
      const s = view.state();
      if (s.status !== 'ready') return;
      const y = yearAt(history.clock.time());
      if (!force && Math.abs(y - appliedYear) < (s.data.step === 'day' ? STEP_YEARS_DATED : STEP_YEARS)) return;
      appliedYear = y;
      const next = new Set<string>();
      for (const key of Object.keys(s.data.values)) {
        const r = countryReading(s.data, key, y);
        if (!r) continue;
        next.add(key);
        map.setFeatureState({ source: SOURCE, id: key }, { t: s.scale.norm(r.v), p: !!r.projected });
      }
      for (const key of painted) if (!next.has(key)) map.removeFeatureState({ source: SOURCE, id: key }, 't');
      painted = next;
      if (hoverKey) hoverAt(hoverKey, view.hovered()?.name ?? hoverKey);
    };

    const hoverAt = (key: string, name: string) => {
      const s = view.state();
      view.setHovered({ key, name, reading: s.status === 'ready' ? countryReading(s.data, key, yearAt(history.clock.time())) : null });
    };

    const outline = () => {
      if (!shown) return;
      const next = new Map(history.chart.countries().map(c => [c.key, c.slot]));
      for (const key of outlined) if (!next.has(key)) map.removeFeatureState({ source: SOURCE, id: key }, 'c');
      for (const [key, slot] of next) map.setFeatureState({ source: SOURCE, id: key }, { c: slot });
      outlined = new Set(next.keys());
    };

    // While the next metric loads, the previous one stays drawn.
    const sync = () => {
      const s = view.state();
      if (s.status === 'off') {
        if (shown) removeLayers(map);
        shown = null;
        painted = new Set();
        outlined = new Set();
        return;
      }
      if (s.status !== 'ready' || s.data === shown) return;
      addLayers(map, dark);
      for (const key of painted) map.removeFeatureState({ source: SOURCE, id: key }, 't');
      painted = new Set();
      shown = s.data;
      paint(true);
      outline();
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
    const onClick = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      const key = typeof f?.id === 'string' ? f.id : null;
      const events = EVENT_LAYERS.filter(l => map.getLayer(l));
      if (!f || !key || (events.length && map.queryRenderedFeatures(e.point, { layers: events }).length)) return;
      history.chart.toggle(key, String(f.properties?.name ?? key));
    };
    const pointer = () => { map.getCanvas().style.cursor = 'pointer'; };
    const unpointer = () => { map.getCanvas().style.cursor = ''; };

    map.on('mousemove', NODATA, onMove);
    map.on('mouseleave', NODATA, onLeave);
    map.on('click', NODATA, onClick);
    map.on('mouseenter', NODATA, pointer);
    map.on('mouseleave', NODATA, unpointer);
    const unview = view.subscribe(sync);
    const unchart = history.chart.subscribe(outline);
    const unclock = history.clock.subscribe(schedule);
    sync();

    return () => {
      clearTimeout(timer);
      unview();
      unchart();
      unclock();
      view.setHovered(null);
      try {
        map.off('mousemove', NODATA, onMove);
        map.off('mouseleave', NODATA, onLeave);
        map.off('click', NODATA, onClick);
        map.off('mouseenter', NODATA, pointer);
        map.off('mouseleave', NODATA, unpointer);
        removeLayers(map);
      } catch {
        // The map itself was removed (a theme change remounts it), taking its layers with it.
      }
    };
  }, [mapRef, mapReady, history, dark]);
}
