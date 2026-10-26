/**
 * TAKIP AI Assist: what the assistant marks on the map.
 *
 * Labelled points (what it found, or places it named), optionally the circle
 * of the area it searched, lines (arrows with their distance, routes, flown
 * tracks) and the outlines of countries or states, drawn above every other layer in the
 * theme's cyan, Assist's colour. New marks pulse a few times as they land,
 * then hold still: a map that repaints itself forever for a highlight is a
 * map that drains a laptop. The marks re-add themselves after a basemap change.
 */
import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl';
import type { Highlight } from './tools';

export interface Highlighter {
  set(h: Highlight | null): void;
  destroy(): void;
}

const POINTS = 'ai-hl-points';
const AREA = 'ai-hl-area';
const LINES = 'ai-hl-lines';
const OUTLINES = 'ai-hl-outlines';
const LAYERS = ['ai-hl-outline-fill', 'ai-hl-outline-line', 'ai-hl-area-fill', 'ai-hl-area-line', 'ai-hl-line', 'ai-hl-arrow', 'ai-hl-line-label', 'ai-hl-halo', 'ai-hl-core', 'ai-hl-label', 'ai-hl-area-label', 'ai-hl-outline-label'] as const;
const SOURCES = [POINTS, AREA, LINES, OUTLINES];
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/** A circle of a radius on the ground, as a polygon (good enough for a highlight at any latitude). */
export function circle(lat: number, lng: number, radiusKm: number, steps = 96): GeoJSON.Polygon {
  const r = radiusKm / 6371;
  const φ1 = (lat * Math.PI) / 180, λ1 = (lng * Math.PI) / 180;
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const θ = (i / steps) * 2 * Math.PI;
    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(r) + Math.cos(φ1) * Math.sin(r) * Math.cos(θ));
    const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(r) * Math.cos(φ1), Math.cos(r) - Math.sin(φ1) * Math.sin(φ2));
    ring.push([((((λ2 * 180) / Math.PI) + 540) % 360) - 180, (φ2 * 180) / Math.PI]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}

export function highlightData(h: Highlight | null): { points: GeoJSON.FeatureCollection; area: GeoJSON.FeatureCollection; lines: GeoJSON.FeatureCollection; outlines: GeoJSON.FeatureCollection } {
  if (!h) return { points: EMPTY, area: EMPTY, lines: EMPTY, outlines: EMPTY };
  return {
    lines: {
      type: 'FeatureCollection',
      features: (h.lines ?? []).map(l => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: l.coords }, properties: { kind: l.kind, label: l.label ?? '' } })),
    },
    outlines: {
      type: 'FeatureCollection',
      features: (h.outlines ?? []).map(o => ({ type: 'Feature', geometry: o.geometry, properties: { label: o.label } })),
    },
    points: {
      type: 'FeatureCollection',
      features: h.points.map((p, i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { label: p.label, n: i + 1 } })),
    },
    area: h.area ? {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: circle(h.area.lat, h.area.lng, h.area.radiusKm), properties: { kind: 'ring' } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [h.area.lng, h.area.lat] }, properties: { kind: 'centre', label: h.area.label } },
      ],
    } : EMPTY,
  };
}

function themeColor(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.body).getPropertyValue(name).trim();
  return /^#[0-9a-f]{3,8}$/i.test(v) || /^rgb/i.test(v) ? v : fallback;
}

export function attachHighlights(map: MlMap): Highlighter {
  let current: Highlight | null = null;
  let pulse = 0;

  const ensure = () => {
    // Assist's colour: cyan in Core, the theme's accent in Ghost.
    const accent = themeColor('--cyan-primary', '#00E5FF');
    for (const id of SOURCES) if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: EMPTY });
    if (!map.getLayer('ai-hl-outline-fill')) {
      map.addLayer({ id: 'ai-hl-outline-fill', type: 'fill', source: OUTLINES, paint: { 'fill-color': accent, 'fill-opacity': 0.05 } });
    }
    if (!map.getLayer('ai-hl-outline-line')) {
      map.addLayer({ id: 'ai-hl-outline-line', type: 'line', source: OUTLINES, paint: { 'line-color': accent, 'line-width': 1.6, 'line-opacity': 0.9 } });
    }
    if (!map.getLayer('ai-hl-area-fill')) {
      map.addLayer({ id: 'ai-hl-area-fill', type: 'fill', source: AREA, filter: ['==', ['get', 'kind'], 'ring'], paint: { 'fill-color': accent, 'fill-opacity': 0.06 } });
    }
    if (!map.getLayer('ai-hl-area-line')) {
      map.addLayer({ id: 'ai-hl-area-line', type: 'line', source: AREA, filter: ['==', ['get', 'kind'], 'ring'], paint: { 'line-color': accent, 'line-width': 1.4, 'line-opacity': 0.85, 'line-dasharray': [2, 2] } });
    }
    if (!map.getLayer('ai-hl-line')) {
      map.addLayer({
        id: 'ai-hl-line', type: 'line', source: LINES, filter: ['!=', ['get', 'kind'], 'arrow'], layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': accent, 'line-width': ['match', ['get', 'kind'], 'route', 3, 2], 'line-opacity': 0.9 },
      });
    }
    // An arrow is a measured line, not a way anyone goes, so it is dashed.
    if (!map.getLayer('ai-hl-arrow')) {
      map.addLayer({ id: 'ai-hl-arrow', type: 'line', source: LINES, filter: ['==', ['get', 'kind'], 'arrow'], paint: { 'line-color': accent, 'line-width': 1.8, 'line-opacity': 0.9, 'line-dasharray': [2, 1.5] } });
    }
    if (!map.getLayer('ai-hl-line-label')) {
      map.addLayer({
        id: 'ai-hl-line-label', type: 'symbol', source: LINES, filter: ['!=', ['get', 'label'], ''],
        layout: { 'symbol-placement': 'line-center', 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-offset': [0, -0.9], 'text-optional': true },
        paint: { 'text-color': '#F5F0E0', 'text-halo-color': 'rgba(4,4,10,0.9)', 'text-halo-width': 1.6 },
      });
    }
    if (!map.getLayer('ai-hl-outline-label')) {
      map.addLayer({
        id: 'ai-hl-outline-label', type: 'symbol', source: OUTLINES,
        layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 10, 'text-letter-spacing': 0.2, 'text-transform': 'uppercase' },
        paint: { 'text-color': accent, 'text-halo-color': 'rgba(4,4,10,0.9)', 'text-halo-width': 1.4 },
      });
    }
    if (!map.getLayer('ai-hl-halo')) {
      map.addLayer({ id: 'ai-hl-halo', type: 'circle', source: POINTS, paint: { 'circle-radius': 13, 'circle-color': accent, 'circle-opacity': 0.22, 'circle-blur': 0.5, 'circle-pitch-alignment': 'map' } });
    }
    if (!map.getLayer('ai-hl-core')) {
      map.addLayer({ id: 'ai-hl-core', type: 'circle', source: POINTS, paint: { 'circle-radius': 4.5, 'circle-color': accent, 'circle-stroke-color': 'rgba(4,4,10,0.9)', 'circle-stroke-width': 2, 'circle-pitch-alignment': 'map' } });
    }
    if (!map.getLayer('ai-hl-label')) {
      map.addLayer({
        id: 'ai-hl-label', type: 'symbol', source: POINTS,
        layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-optional': true, 'text-max-width': 14 },
        paint: { 'text-color': '#F5F0E0', 'text-halo-color': 'rgba(4,4,10,0.9)', 'text-halo-width': 1.6 },
      });
    }
    if (!map.getLayer('ai-hl-area-label')) {
      map.addLayer({
        id: 'ai-hl-area-label', type: 'symbol', source: AREA, filter: ['==', ['get', 'kind'], 'centre'],
        layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 10, 'text-letter-spacing': 0.2, 'text-transform': 'uppercase', 'text-offset': [0, -1.4] },
        paint: { 'text-color': accent, 'text-halo-color': 'rgba(4,4,10,0.9)', 'text-halo-width': 1.4 },
      });
    }
    // Above everything drawn since.
    for (const id of LAYERS) if (map.getLayer(id)) map.moveLayer(id);
    const d = highlightData(current);
    (map.getSource(POINTS) as GeoJSONSource).setData(d.points);
    (map.getSource(AREA) as GeoJSONSource).setData(d.area);
    (map.getSource(LINES) as GeoJSONSource).setData(d.lines);
    (map.getSource(OUTLINES) as GeoJSONSource).setData(d.outlines);
  };

  const rest = () => {
    cancelAnimationFrame(pulse);
    pulse = 0;
    if (!map.getLayer('ai-hl-halo')) return;
    map.setPaintProperty('ai-hl-halo', 'circle-radius', 13);
    map.setPaintProperty('ai-hl-halo', 'circle-opacity', 0.22);
  };

  /** Three pulses as new marks land, then still. */
  const land = () => {
    cancelAnimationFrame(pulse);
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = (now - t0) / 700;
      if (!map.getLayer('ai-hl-halo')) return;
      if (t >= 3) return rest();
      const k = t % 1;
      map.setPaintProperty('ai-hl-halo', 'circle-radius', 8 + 18 * k);
      map.setPaintProperty('ai-hl-halo', 'circle-opacity', 0.5 * (1 - k));
      pulse = requestAnimationFrame(tick);
    };
    pulse = requestAnimationFrame(tick);
  };

  const onStyle = () => { if (map.isStyleLoaded() && !map.getSource(POINTS)) ensure(); };
  map.on('styledata', onStyle);
  if (map.isStyleLoaded()) ensure();

  return {
    set(h) {
      current = h;
      // isStyleLoaded() is false while any tile loads, so through every camera move; only a style being swapped refuses
      // layers, and onStyle draws the marks once it's in.
      try {
        ensure();
      } catch {
        return;
      }
      if (h && !h.quiet) land();
      else if (pulse) rest();
    },
    destroy() {
      cancelAnimationFrame(pulse);
      map.off('styledata', onStyle);
      for (const id of [...LAYERS].reverse()) if (map.getLayer(id)) map.removeLayer(id);
      for (const id of SOURCES) if (map.getSource(id)) map.removeSource(id);
    },
  };
}
