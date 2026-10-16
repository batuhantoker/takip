'use client';

import { useEffect } from 'react';
import { EMPTY_FC } from '@/lib/map/basemap/bands/shared';
import { computeSolarTerminator } from '@/lib/map/basemap/solar-terminator';
import { photoBefore, rasterBefore, setGround } from '@/lib/map/basemap/imagery-legibility';
import { stackGroundRasters } from '@/lib/map/basemap/ground-rasters';
import { BUILDINGS_LAYER, buildingColor, getBuildingStyle, readAccent } from '@/lib/map/basemap/buildings';
import { useBuildingPaint } from './use-building-style';
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
        if (!map.getLayer(BUILDINGS_LAYER)) {
          const look = getBuildingStyle();
          map.addLayer({
            id: BUILDINGS_LAYER,
            source: 'basemap',
            'source-layer': 'building',
            type: 'fill-extrusion',
            minzoom: 14.5,
            paint: {
              'fill-extrusion-color': buildingColor(look.look, readAccent()),
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
              // The rise from zoom 14.5 eases them in, so no fade: below 100% is the person's choice.
              'fill-extrusion-opacity': look.opacity,
            },
          });
        }

        // Pitch the camera to reveal the 3D skyline
        if (map.getPitch() < 40) {
          map.easeTo({ pitch: 50, duration: 1200 });
        }

      } else {
        // ── DISABLE 3D ──
        if (map.getLayer(BUILDINGS_LAYER)) map.removeLayer(BUILDINGS_LAYER);
      }
    } catch (e) {
      console.warn('[TAKIP] 3D terrain toggle error:', e);
    }
  }, [mapReady, activeLayers.terrain_3d, mapRef]);
  useBuildingPaint({ mapRef, mapReady, on: !!activeLayers.terrain_3d });

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
