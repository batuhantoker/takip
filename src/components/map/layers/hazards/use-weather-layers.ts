'use client';

import { useEffect, useState, type RefObject } from 'react';
import * as maplibregl from 'maplibre-gl';
import { CLOUDS_ATTRIBUTION, CLOUDS_CREDIT, CLOUDS_LAYER, frameTime } from '@/lib/weather/live-clouds';
import { createCloudLayer } from '@/lib/weather/live-clouds-layer';
import { EMPTY_FC } from '@/lib/basemap/base-layers';
import {
  FIELD_MAX_ZOOM, GFS_ATTRIBUTION, GFS_MAX_ZOOM, RADAR_ATTRIBUTION, RADAR_MAX_ZOOM, WX_ATTRIBUTION,
  decodeField, fieldFromGrid, fieldTileUrl, installWeatherProtocol, latestRadarTiles, setTemperatureField,
  type TemperatureField, type WeatherGrid,
} from '@/lib/weather/weather-field';
import { toUnit, useTemperatureUnit } from '@/lib/weather/temperature-unit';
import { stackGroundRasters } from '@/lib/basemap/ground-rasters';
import type { LayerHookArgs, MapRef, WorldMapProps } from '@/components/map/types';

export function useWeatherGridLayer({ mapReady, data, activeLayers, setGeo }: LayerHookArgs) {
  const unit = useTemperatureUnit();
  useEffect(() => {
    if (!mapReady) return;
    const grid: WeatherGrid | null = data.weather_grid ?? null;
    const hour = grid ? `${grid.time.slice(11, 16)} UTC` : '';
    setGeo('wx-points', grid && (activeLayers.wx_temperature || activeLayers.wx_wind)
      ? grid.points.map(p => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: {
        ...p, hour, shownTemp: p.temp == null ? null : Math.round(toUnit(p.temp, unit)),
      } }))
      : []);
  }, [mapReady, data.weather_grid, activeLayers.wx_temperature, activeLayers.wx_wind, unit, setGeo]);
}

/** The 0.25° GFS field while the temperature layer is on; null until it loads, or if the route never answers. */
function useGfsField(active: boolean): TemperatureField | null {
  const [field, setField] = useState<TemperatureField | null>(null);
  useEffect(() => {
    if (!active) return;
    const ctrl = new AbortController();
    const load = async () => {
      try {
        const res = await fetch('/api/weather-field', { signal: ctrl.signal });
        if (!res.ok) throw new Error(`answered ${res.status}`);
        const next = decodeField(await res.arrayBuffer());
        setField(prev => (prev?.time === next.time ? prev : next));
      } catch (e) {
        if (!ctrl.signal.aborted) console.warn('[TAKIP] Temperature field load failed:', e instanceof Error ? e.message : e);
      }
    };
    load();
    // The route moves to the next 3-hour step on its own; this just picks it up.
    const refresh = setInterval(() => { if (!document.hidden) load(); }, 15 * 60_000);
    return () => { ctrl.abort(); clearInterval(refresh); };
  }, [active]);
  return field;
}

interface WeatherRasterArgs {
  mapRef: MapRef;
  mapReady: boolean;
  data: WorldMapProps['data'];
  activeLayers: WorldMapProps['activeLayers'];
  mapStyle: string;
  cloudLayerRef: RefObject<ReturnType<typeof createCloudLayer> | null>;
}

export function useWeatherRasters({ mapRef, mapReady, data, activeLayers, mapStyle, cloudLayerRef }: WeatherRasterArgs) {
  // Live Clouds — NOAA's satellite mosaic, hung at cloud altitude over the
  // ground; see lib/weather/live-clouds-layer. Under the night shade and every marker.
  // On the map they also sit under the place names, as on any weather map, so
  // a storm never hides a city's name; on SAT they go above the imagery, which
  // covers those names anyway. Nothing is fetched until the layer is first
  // switched on, and switching it off frees what it held on the GPU.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    if (!activeLayers.live_clouds) {
      if (map.getLayer(CLOUDS_LAYER)) map.removeLayer(CLOUDS_LAYER);
      if (map.getLayer(CLOUDS_CREDIT)) map.removeLayer(CLOUDS_CREDIT);
      cloudLayerRef.current = null;
      return;
    }
    if (!cloudLayerRef.current || !map.getLayer(CLOUDS_LAYER)) {
      cloudLayerRef.current = createCloudLayer(CLOUDS_LAYER);
      map.addLayer(cloudLayerRef.current, 'day-night-fill');
    }
    const clouds = cloudLayerRef.current;
    clouds.setFrame(frameTime());
    // MapLibre credits the sources its visible layers draw from. The clouds
    // come from no source of its own, so an empty one carries NOAA's credit.
    if (!map.getSource(CLOUDS_CREDIT)) map.addSource(CLOUDS_CREDIT, { type: 'geojson', data: EMPTY_FC, attribution: CLOUDS_ATTRIBUTION });
    if (!map.getLayer(CLOUDS_CREDIT)) map.addLayer({ id: CLOUDS_CREDIT, type: 'circle', source: CLOUDS_CREDIT });
    stackGroundRasters(map);
    // A new frame lands every hour; move to it once it is up.
    const refresh = setInterval(() => clouds.setFrame(frameTime()), 5 * 60_000);
    return () => clearInterval(refresh);
  }, [mapReady, activeLayers.live_clouds, mapStyle, mapRef, cloudLayerRef]);

  // Temperature field — GFS at 0.25° once it loads, the Open-Meteo grid until then
  // or if it never does; painted client-side either way (lib/weather/weather-field).
  const gfs = useGfsField(!!activeLayers.wx_temperature);
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const grid: WeatherGrid | null = data.weather_grid ?? null;
    const field = gfs ?? (grid ? fieldFromGrid(grid) : null);
    setTemperatureField(field);
    if (!activeLayers.wx_temperature) {
      if (map.getLayer('wx-field')) map.removeLayer('wx-field');
      return;
    }
    installWeatherProtocol(maplibregl.addProtocol);
    const url = fieldTileUrl(field);
    const maxzoom = gfs ? GFS_MAX_ZOOM : FIELD_MAX_ZOOM;
    let source = map.getSource('wx-field') as maplibregl.RasterTileSource | undefined;
    // A source fixes its zoom cap and credit when added, so moving between GFS and the grid re-adds it.
    if (source && source.maxzoom !== maxzoom) {
      if (map.getLayer('wx-field')) map.removeLayer('wx-field');
      map.removeSource('wx-field');
      source = undefined;
    }
    if (!source) {
      map.addSource('wx-field', { type: 'raster', tiles: [url], tileSize: 256, maxzoom, attribution: gfs ? GFS_ATTRIBUTION : WX_ATTRIBUTION });
    } else if (source.tiles?.[0] !== url) {
      source.setTiles([url]);
    }
    if (!map.getLayer('wx-field')) {
      map.addLayer({ id: 'wx-field', type: 'raster', source: 'wx-field', paint: { 'raster-opacity': 0.5, 'raster-resampling': 'linear', 'raster-fade-duration': 0 } }, 'day-night-fill');
    }
    stackGroundRasters(map);
  }, [mapReady, activeLayers.wx_temperature, data.weather_grid, gfs, mapStyle, mapRef]);

  // Precipitation radar — RainViewer's latest frame, where ground radar exists.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    if (!activeLayers.wx_radar) {
      if (map.getLayer('wx-radar')) map.removeLayer('wx-radar');
      return;
    }
    const ctrl = new AbortController();
    const load = async () => {
      try {
        const tiles = await latestRadarTiles(ctrl.signal);
        if (!tiles || ctrl.signal.aborted) return;
        const source = map.getSource('wx-radar') as maplibregl.RasterTileSource | undefined;
        if (!source) {
          map.addSource('wx-radar', { type: 'raster', tiles: [tiles], tileSize: 256, maxzoom: RADAR_MAX_ZOOM, attribution: RADAR_ATTRIBUTION });
        } else if (source.tiles?.[0] !== tiles) {
          source.setTiles([tiles]);
        }
        if (!map.getLayer('wx-radar')) {
          map.addLayer({ id: 'wx-radar', type: 'raster', source: 'wx-radar', paint: { 'raster-opacity': 0.75, 'raster-fade-duration': 0 } }, 'day-night-fill');
        }
        stackGroundRasters(map);
      } catch (e) {
        if (!ctrl.signal.aborted) console.warn('[TAKIP] Radar frame lookup failed:', e instanceof Error ? e.message : e);
      }
    };
    load();
    // RainViewer publishes a frame every 10 minutes.
    const refresh = setInterval(load, 5 * 60_000);
    return () => { ctrl.abort(); clearInterval(refresh); };
  }, [mapReady, activeLayers.wx_radar, mapStyle, mapRef]);
}
