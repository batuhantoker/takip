'use client';

import { useEffect } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { photoBefore } from '@/lib/map/basemap/imagery-legibility';
import { areaOutline, type ImageryArea } from '@/lib/feeds/imagery/area';
import type { ScenePass } from '@/lib/feeds/imagery/passes';
import type { ImagerElements } from '@/lib/feeds/imagery/scene-search';
import { LABEL_SIZE, MAP_INK, labelPaint } from '@/lib/map/style/tokens';
import { orbitPath, propagateTLE, splitAtAntimeridian } from '@/lib/feeds/satellites/orbit';
import type { MapRef } from '@/components/map/types';

const SCENE = 'imagery-scene';
const AREA = 'imagery-area';
const SAT = 'imagery-satellite';
const SAT_LAYERS = [`${SAT}-track`, `${SAT}-dot`, `${SAT}-label`];
export const IMAGERY_CREDIT = 'Copernicus Sentinel data · Landsat courtesy of USGS · via Microsoft Planetary Computer';

function bbox(g: GeoJSON.Geometry | null): [number, number, number, number] | undefined {
  if (!g || !('coordinates' in g)) return undefined;
  const xs: number[] = [], ys: number[] = [];
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === 'number') { xs.push(c[0] as number); ys.push(c[1] as number); }
    else if (Array.isArray(c)) c.forEach(walk);
  };
  walk(g.coordinates);
  return xs.length ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] : undefined;
}

function remove(map: maplibregl.Map, layers: string[], sources: string[]) {
  for (const id of layers) if (map.getLayer(id)) map.removeLayer(id);
  for (const id of sources) if (map.getSource(id)) map.removeSource(id);
}

/**
 * The searched area's outline, the picked pass's tiles in the photo slot, and where its satellite is now
 * with the orbit ahead.
 */
export function useImageryOverlay(mapRef: MapRef, area: ImageryArea, pass: ScenePass | null, sat: ImagerElements | undefined, satName: string | undefined) {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.addSource(AREA, { type: 'geojson', data: { type: 'Feature', geometry: areaOutline(area), properties: {} } });
    map.addLayer({ id: AREA, type: 'line', source: AREA, paint: { 'line-color': MAP_INK.blue, 'line-width': 1.25, 'line-dasharray': [3, 2], 'line-opacity': 0.9 } });
    return () => remove(map, [AREA], [AREA]);
  }, [mapRef, area]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pass) return;
    const tiles = pass.tiles.filter(s => s.tiles);
    const ids = tiles.map((_, i) => `${SCENE}-${i}`);
    // Each goes in just under the base map's borders, so the clearest, added last, ends up on top.
    tiles.forEach((s, i) => {
      const bounds = bbox(s.footprint);
      map.addSource(ids[i], { type: 'raster', tiles: [s.tiles!], tileSize: 256, maxzoom: 16, attribution: IMAGERY_CREDIT, ...(bounds && { bounds }) });
      map.addLayer({ id: ids[i], type: 'raster', source: ids[i], paint: { 'raster-fade-duration': 0 } }, photoBefore(map));
    });
    return () => remove(map, ids, ids);
  }, [mapRef, pass]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sat) return;
    const draw = () => {
      const now = new Date();
      const at = propagateTLE(sat.line1, sat.line2, now);
      const track = splitAtAntimeridian(orbitPath(sat.line1, sat.line2, 180, now)).map(run => run.map(p => [p.lng, p.lat]));
      const features: GeoJSON.Feature[] = [{ type: 'Feature', geometry: { type: 'MultiLineString', coordinates: track }, properties: {} }];
      if (at) features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [at.lng, at.lat] }, properties: { name: satName ?? '' } });
      (map.getSource(SAT) as maplibregl.GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
    };
    map.addSource(SAT, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    // The orbit ahead, dashed: where it will be, not where it has been.
    map.addLayer({ id: SAT_LAYERS[0], type: 'line', source: SAT, filter: ['!=', ['geometry-type'], 'Point'], paint: { 'line-color': MAP_INK.blue, 'line-width': 1.25, 'line-dasharray': [2, 2], 'line-opacity': 0.8 } });
    map.addLayer({ id: SAT_LAYERS[1], type: 'circle', source: SAT, filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 5, 'circle-color': MAP_INK.blue, 'circle-stroke-color': MAP_INK.surface0, 'circle-stroke-width': 1.5 } });
    map.addLayer({ id: SAT_LAYERS[2], type: 'symbol', source: SAT, filter: ['==', ['geometry-type'], 'Point'], layout: {
      'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': LABEL_SIZE, 'text-offset': [0, 1.2], 'text-anchor': 'top',
    }, paint: labelPaint() });
    draw();
    const id = setInterval(draw, 5000);
    return () => { clearInterval(id); remove(map, SAT_LAYERS, [SAT]); };
  }, [mapRef, sat, satName]);
}
