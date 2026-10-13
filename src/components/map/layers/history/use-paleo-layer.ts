'use client';

import { useEffect } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { maAt } from '@/lib/paleo/deep-time';
import { motionAt, trailTo } from '@/lib/paleo/motion';
import { loadPlateModel, type Pin, type PlateModel } from '@/lib/paleo/reconstruct';
import { CHAPTERS, PLACES } from '@/lib/paleo/story';
import type { HistorySession } from '@/lib/history/session';
import { addLayers, MARKS, PIN_DOT, removeLayers, SHAPES, TRAILS } from '@/lib/paleo/map-style';
import type { MapRef } from '@/components/map/types';

/*
 * History's deep time on the map: an opaque ocean over the whole basemap, today's coastlines and crust
 * carried back on their plates, a graticule to read their drift against, today's places riding along with
 * the path they came by, their heading and speed, and a pin for each documentary chapter. Everything sits
 * on top; only the basemap's labels need hiding. In motion the shapes are thinned and redrawn every frame,
 * and drawn in full once the clock settles.
 */

/** Full detail once the clock has been still this long. */
const SETTLE_MS = 220;
/** Each place trails the path of its last this many million years. */
const TRAIL_MA = 30;
const TRAIL_STEP_MA = 1.5;
const RAD = Math.PI / 180;
/** The camera stays within this latitude; past it the globe's Mercator zoom swells and a pole fills the screen. */
const MAX_CAMERA_LAT = 40;

/** The globe draws zoom at Mercator scale for the centre's latitude; this keeps it the same size anywhere. */
const globeZoom = (map: maplibregl.Map, zoom: number, lat: number) => Math.max(map.getMinZoom(), zoom + Math.log2(Math.cos(lat * RAD)));

/** A pin shows from its chapter's age for a while after: longer in the deep past, where the clock runs faster. */
const linger = (ma: number) => Math.min(120, Math.max(12, ma * 0.15));

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
    let appliedCoarse = false;
    let appliedChapter: number | null = null;
    let frame: number | undefined;
    let settle: ReturnType<typeof setTimeout> | undefined;
    let loading = false;
    let gone = false;

    const marks = (ma: number): { marks: GeoJSON.FeatureCollection; trails: GeoJSON.FeatureCollection } => {
      const features: GeoJSON.Feature[] = [];
      const trails: GeoJSON.Feature[] = [];
      for (const p of places) {
        const m = motionAt(model!, p.pin, ma);
        if (!m) continue;
        const speed = m.cmPerYear >= 0.05 ? `${m.cmPerYear.toFixed(m.cmPerYear < 10 ? 1 : 0)} cm/yr` : 'still';
        features.push({ type: 'Feature', properties: { k: 'place', name: p.name, speed, cm: m.cmPerYear, bearing: m.bearing }, geometry: { type: 'Point', coordinates: m.at } });
        const path = trailTo(model!, p.pin, ma, TRAIL_MA, TRAIL_STEP_MA);
        if (path.length > 1) trails.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: path } });
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
      return { marks: { type: 'FeatureCollection', features }, trails: { type: 'FeatureCollection', features: trails } };
    };

    const setData = (id: string, data: GeoJSON.FeatureCollection) => (map.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData(data);

    /** Thinned while the clock moves; MapLibre drops any update the worker hasn't reached, so every frame is fine. */
    const paint = (coarse: boolean, force = false) => {
      if (!model || !shown) return;
      const ma = maAt(history.deepClock.time());
      if (!force && ma === appliedMa && coarse === appliedCoarse) return;
      const moved = ma !== appliedMa || force;
      appliedMa = ma;
      appliedCoarse = coarse;
      setData(SHAPES, model.at(ma, coarse));
      if (!moved) return;
      const { marks: m, trails } = marks(ma);
      setData(MARKS, m);
      setData(TRAILS, trails);
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
        duration: history.story.arrived() ? 1800 : history.story.legMs(),
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
      paint(false, true);
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

    // Every change paints thinned on the next frame; full detail follows once changes stop.
    const onClock = () => {
      if (!shown) return;
      frame ??= requestAnimationFrame(() => {
        frame = undefined;
        paint(true);
      });
      clearTimeout(settle);
      settle = setTimeout(() => { if (!history.deepClock.playing()) paint(false); }, SETTLE_MS);
    };
    const onStory = () => {
      if (!shown) return;
      flyToChapter();
      paint(history.deepClock.playing(), true);
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

    const offs = [history.subscribe(sync), history.deepClock.subscribe(onClock), history.story.subscribe(onStory)];
    sync();

    return () => {
      gone = true;
      if (frame !== undefined) cancelAnimationFrame(frame);
      clearTimeout(settle);
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
