'use client';

import { useEffect } from 'react';
import type * as maplibregl from 'maplibre-gl';
import type { MapPin, MapRef } from '@/components/map/types';
import { labelPaint, MAP_INK } from '@/lib/map/style/tokens';

const SRC = 'place-pin';
const LAYERS = ['place-pin-halo', 'place-pin-dot', 'place-pin-label'];

/** The place a page is about, marked so it stands out whatever else is on the map. */
export function usePlacePin({ mapRef, mapReady, pin }: { mapRef: MapRef; mapReady: boolean; pin: MapPin | null }) {
  const { lat, lng, name } = pin ?? {};
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    if (lat === undefined || lng === undefined) {
      LAYERS.forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
      if (map.getSource(SRC)) map.removeSource(SRC);
      return;
    }
    const data: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { name: name ?? '' }, geometry: { type: 'Point', coordinates: [lng, lat] } }],
    };
    const source = map.getSource(SRC) as maplibregl.GeoJSONSource | undefined;
    if (source) { source.setData(data); return; }
    map.addSource(SRC, { type: 'geojson', data });
    map.addLayer({ id: 'place-pin-halo', type: 'circle', source: SRC, paint: { 'circle-radius': 16, 'circle-color': MAP_INK.teal, 'circle-opacity': 0.22, 'circle-blur': 0.4 } });
    map.addLayer({ id: 'place-pin-dot', type: 'circle', source: SRC, paint: {
      'circle-radius': 5, 'circle-color': MAP_INK.ink1, 'circle-stroke-width': 2.5, 'circle-stroke-color': MAP_INK.teal,
    } });
    map.addLayer({ id: 'place-pin-label', type: 'symbol', source: SRC, layout: {
      'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 14,
      'text-anchor': 'left', 'text-offset': [1.2, 0], 'text-allow-overlap': true, 'text-ignore-placement': true,
    }, paint: labelPaint(MAP_INK.ink1) });
  }, [mapReady, mapRef, lat, lng, name]);
}
