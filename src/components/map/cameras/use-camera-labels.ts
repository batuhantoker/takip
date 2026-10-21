'use client';

import { useEffect } from 'react';
import type * as maplibregl from 'maplibre-gl';
import type { LayerHookArgs } from '@/components/map/types';
import { cameraDetails } from '@/lib/feeds/cameras/camera-details';
import { CCTV_LABEL_MIN_ZOOM, CCTV_NAMED_SOURCE } from '@/lib/feeds/cameras/map-layers';

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
/** Up close a screen rarely holds more; past this, the nearest go unnamed. */
const MAX_LABELS = 200;

/** Names the camera dots in view once the map is close enough to label them (the pins carry no names). */
export function useCameraLabels({ mapRef, mapReady, data, activeLayers }: LayerHookArgs) {
  const on = !!activeLayers.cctv;
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    let generation = 0;
    let shown = '';
    const source = () => map.getSource(CCTV_NAMED_SOURCE) as maplibregl.GeoJSONSource | undefined;

    let target = source();

    const update = async () => {
      const mine = ++generation;
      // A basemap switch re-adds the source empty.
      if (source() !== target) { target = source(); shown = ''; }
      if (!on || map.getZoom() < CCTV_LABEL_MIN_ZOOM) {
        if (shown) source()?.setData(EMPTY);
        shown = '';
        return;
      }
      let features: maplibregl.MapGeoJSONFeature[];
      try {
        features = map.queryRenderedFeatures({ layers: ['cctv-dots'] });
      } catch {
        return; // layer not added yet
      }
      const at = new Map<string, GeoJSON.Position>();
      for (const f of features) {
        if (f.geometry.type === 'Point' && f.properties?.id != null) at.set(String(f.properties.id), f.geometry.coordinates);
        if (at.size >= MAX_LABELS) break;
      }
      const key = [...at.keys()].join('\n');
      if (key === shown) return;
      const records = await cameraDetails([...at.keys()]);
      if (mine !== generation) return;
      shown = key;
      source()?.setData({
        type: 'FeatureCollection',
        features: [...records].filter(([, r]) => r.name).map(([id, r]) => ({
          type: 'Feature', geometry: { type: 'Point', coordinates: at.get(id)! }, properties: { id, name: String(r.name) },
        })),
      });
    };

    const onSourceData = (e: maplibregl.MapSourceDataEvent) => {
      if (e.sourceId === 'cctv' && e.isSourceLoaded) void update();
    };
    void update();
    map.on('moveend', update);
    map.on('sourcedata', onSourceData);
    return () => {
      generation++;
      map.off('moveend', update);
      map.off('sourcedata', onSourceData);
    };
  }, [mapRef, mapReady, on, data.cameras]);
}
