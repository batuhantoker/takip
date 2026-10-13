'use client';

import { useEffect } from 'react';
import { EMPTY_FC } from '@/lib/basemap/base-layers';
import { computeSolarTerminator } from '@/lib/basemap/solar-terminator';
import { photoBefore, rasterBefore, setGround } from '@/lib/basemap/imagery-legibility';
import { stackGroundRasters } from '@/lib/basemap/ground-rasters';
import type { MapRef, WorldMapProps } from '@/components/map/types';

interface BasemapArgs {
  mapRef: MapRef;
  mapReady: boolean;
  activeLayers: WorldMapProps['activeLayers'];
}

export function useDayNight({ mapRef, mapReady, activeLayers }: BasemapArgs) {
  // Day/Night
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const update = () => {
      const src = map.getSource('day-night') as any;
      if (!src) return;
      if (!activeLayers.day_night) { src.setData(EMPTY_FC); return; }
      src.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [computeSolarTerminator()] }, properties: {} }] });
    };
    update();
    const iv = setInterval(update, 300000); // 5 min (was 1 min — shadow barely moves)
    return () => clearInterval(iv);
  }, [mapReady, activeLayers.day_night, mapRef]);
}

export function useBasemapStyle({ mapRef, mapReady, activeLayers, mapStyle }: BasemapArgs & { mapStyle: string }) {
  // 3D buildings are independent of the elevation renderer.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const enabled = activeLayers.terrain_3d;

    try {
      if (enabled) {
        // The basemap's vector tiles already carry building footprints and
        // render heights. No second worldwide vector source is needed.

        // ── 3D BUILDING EXTRUSION LAYER ──
        if (!map.getLayer('takip-3d-buildings')) {
          map.addLayer({
            id: 'takip-3d-buildings',
            source: 'basemap',
            'source-layer': 'building',
            type: 'fill-extrusion',
            minzoom: 14.5,
            paint: {
              'fill-extrusion-color': [
                'interpolate', ['linear'], ['get', 'render_height'],
                0, '#1a1a2e',
                20, '#16213e',
                50, '#0f3460',
                120, '#533483',
                300, '#e94560',
              ],
              'fill-extrusion-height': [
                'interpolate', ['linear'], ['zoom'],
                14.5, 0,
                15.5, ['get', 'render_height']
              ],
              'fill-extrusion-base': [
                'interpolate', ['linear'], ['zoom'],
                14.5, 0,
                15.5, ['get', 'render_min_height']
              ],
              'fill-extrusion-opacity': [
                'interpolate', ['linear'], ['zoom'],
                14.5, 0,
                15, 0.7,
              ],
            },
          });
        }

        // Pitch the camera to reveal the 3D skyline
        if (map.getPitch() < 40) {
          map.easeTo({ pitch: 50, duration: 1200 });
        }

      } else {
        // ── DISABLE 3D ──
        if (map.getLayer('takip-3d-buildings')) map.removeLayer('takip-3d-buildings');
      }
    } catch (e) {
      console.warn('[TAKIP] 3D terrain toggle error:', e);
    }
  }, [mapReady, activeLayers.terrain_3d, mapRef]);

  // Satellite / Topo / Dark style switching
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    try {
      // OpenTopoMap: CC-BY-SA, attribution required; fair use only, so no prefetching. Tiles stop at z17.
      if (mapStyle === 'topo') {
        if (!map.getSource('topo-tiles')) {
          map.addSource('topo-tiles', {
            type: 'raster',
            tiles: ['a', 'b', 'c'].map(s => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`),
            tileSize: 256,
            maxzoom: 17,
            attribution: 'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM · Style © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
          });
        }
        if (!map.getLayer('topo-layer')) {
          // Toned down so markers stay the loudest thing on the map.
          map.addLayer({ id: 'topo-layer', type: 'raster', source: 'topo-tiles', paint: { 'raster-opacity': 0.9, 'raster-saturation': -0.35 } }, rasterBefore(map));
        } else {
          map.setLayoutProperty('topo-layer', 'visibility', 'visible');
        }
      } else if (map.getLayer('topo-layer')) {
        map.setLayoutProperty('topo-layer', 'visibility', 'none');
      }

      if (mapStyle !== 'dark' && mapStyle !== 'topo') {
        // Add satellite raster tiles
        if (!map.getSource('satellite-tiles')) {
          map.addSource('satellite-tiles', {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            maxzoom: 18,
          });
        }
        if (!map.getLayer('satellite-layer')) {
          map.addLayer({ id: 'satellite-layer', type: 'raster', source: 'satellite-tiles', paint: { 'raster-opacity': 0.85 } }, photoBefore(map));
        } else {
          map.moveLayer('satellite-layer', photoBefore(map));
          map.setLayoutProperty('satellite-layer', 'visibility', 'visible');
        }
      } else {
        if (map.getLayer('satellite-layer')) {
          map.setLayoutProperty('satellite-layer', 'visibility', 'none');
        }
      }
      setGround(map, mapStyle === 'dark' || mapStyle === 'topo' ? mapStyle : 'satellite');
      stackGroundRasters(map);
    } catch (e) {
      console.warn('Style switch failed:', e);
    }
  }, [mapReady, mapStyle, mapRef]);
}
