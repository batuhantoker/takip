'use client';

import { useEffect, useRef } from 'react';
import { createEarthSkyLayer, type EarthSkyLayer, type SkyMark, type StarCatalog } from '@/lib/space/earth-sky-layer';
import { jdFromMs } from '@/lib/space/horizons';
import { sampleAt } from '@/lib/space/sky';
import { EARTH_RADIUS_KM } from '@/lib/space/sky-projection';
import { useSky } from '@/components/panels/space/use-space-data';
import type { MapRef, WorldMapProps } from '@/components/map/types';

const LAYER_ID = 'earth-sky';
/** The sky turns a quarter of a degree a minute; nothing here needs a faster redraw than that. */
const REDRAW_MS = 20_000;

let catalogLoad: Promise<StarCatalog | null> | null = null;
const loadCatalog = () => (catalogLoad ??= fetch('/data/sky/bright-stars.json').then(r => (r.ok ? r.json() : null)).catch(() => null));

export function useEarthSky({ mapRef, mapReady, activeLayers }: { mapRef: MapRef; mapReady: boolean; activeLayers: WorldMapProps['activeLayers'] }) {
  const on = !!activeLayers.sky_stars;
  const sky = useSky(on);
  const layerRef = useRef<EarthSkyLayer | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !on) return;
    const layer = createEarthSkyLayer(LAYER_ID);
    // Under everything else, so the map's own layers draw over the sky.
    map.addLayer(layer, map.getStyle().layers[0]?.id);
    layerRef.current = layer;
    loadCatalog().then(c => { if (c && layerRef.current === layer) layer.setCatalog(c); });
    const tick = setInterval(() => map.triggerRepaint(), REDRAW_MS);
    return () => {
      clearInterval(tick);
      layerRef.current = null;
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    };
  }, [mapReady, mapRef, on]);

  // Re-run on mapReady too: the sky often lands before the map, when there is no layer to hand it to.
  useEffect(() => {
    if (!sky || !layerRef.current) return;
    const update = () => {
      const jd = jdFromMs(Date.now());
      const marks: SkyMark[] = [];
      for (const b of sky.bodies) {
        const s = sampleAt(b.track, jd);
        if (!s) continue;
        marks.push({
          name: b.name,
          kind: b.kind === 'star' ? 'sun' : b.kind === 'moon' ? 'moon' : 'planet',
          ra: s.ra, dec: s.dec,
          // Only the Moon is near enough for the camera's own position to matter.
          dist: b.kind === 'moon' ? s.km / EARTH_RADIUS_KM : Infinity,
          color: b.color,
          illum: s.illum,
        });
      }
      layerRef.current?.setMarks(marks);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [sky, on, mapReady]);
}
