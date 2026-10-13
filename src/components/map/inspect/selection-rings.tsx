'use client';

import { useEffect } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { useWindows } from '@/components/map/windows';
import type { MapRef } from '@/components/map/types';
import { MAP_INK } from '@/lib/map/tokens';
import { useRings } from './rings';

const SRC = 'inspect-selection';
const LAYER = 'inspect-selection-ring';

/** A ring around each open window's subject; the frontmost window's is the strong one. */
export function SelectionRings({ mapRef }: { mapRef: MapRef }) {
  const rings = useRings();
  const { list } = useWindows();
  // On a phone there are no windows, only the one sheet's ring.
  const front = list.filter(w => rings[w.id]).sort((a, b) => b.z - a.z)[0]?.id ?? Object.keys(rings).at(-1);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.getSource(SRC)) map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    if (!map.getLayer(LAYER)) {
      map.addLayer({ id: LAYER, type: 'circle', source: SRC, paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 9, 10, 12, 16, 15],
        'circle-color': 'transparent',
        'circle-stroke-color': MAP_INK.ink1,
        'circle-stroke-width': ['case', ['get', 'front'], 1.75, 1],
        'circle-stroke-opacity': ['case', ['get', 'front'], 0.95, 0.45],
      }});
    }
    (map.getSource(SRC) as maplibregl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: Object.entries(rings).map(([id, p]) => ({
        type: 'Feature', properties: { front: id === front }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      })),
    });
  }, [mapRef, rings, front]);

  useEffect(() => () => {
    (mapRef.current?.getSource(SRC) as maplibregl.GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: [] });
  }, [mapRef]);

  return null;
}
