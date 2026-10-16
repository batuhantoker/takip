'use client';

import { useEffect } from 'react';
import * as maplibregl from 'maplibre-gl';
import { photoBefore } from '@/lib/map/basemap/imagery-legibility';
import { datedRaster } from '@/lib/feeds/imagery/dated-raster';
import { SECTORS } from '@/lib/feeds/imagery/geostationary';
import { geosatTiles, installGeosatProtocol, latestSectorFrame } from '@/lib/feeds/imagery/geosat-protocol';
import { DAILY_MAX_ZOOM, GIBS_ATTRIBUTION, dailyDay, dailyProduct, replayFrame, tileUrl } from '@/lib/feeds/imagery/gibs';
import type { ReplayClock } from '@/lib/map/replay/clock';
import { followClock } from '@/lib/map/replay/follow';
import type { MapRef, WorldMapProps } from '@/components/map/types';

type Timeline = { clock: ReplayClock } | null;

interface GibsImageryArgs {
  mapRef: MapRef;
  mapReady: boolean;
  activeLayers: WorldMapProps['activeLayers'];
  mapStyle: string;
  history: Timeline;
  replay: Timeline;
}

/**
 * Satellite imagery in the photo slot, under borders and names:
 * Satellite Daily is NASA GIBS's whole Earth on the timeline's day, or yesterday when live;
 * Satellite Live is the geostationary ring every 10 minutes (lib/feeds/imagery/geostationary), at Replay's time when replaying.
 */
export function useGibsImagery({ mapRef, mapReady, activeLayers, mapStyle, history, replay }: GibsImageryArgs) {
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !activeLayers.sat_daily) return;
    const raster = datedRaster(map, { id: 'gibs-daily', maxzoom: DAILY_MAX_ZOOM, attribution: GIBS_ATTRIBUTION, before: () => photoBefore(map) });
    const timeline = history ?? replay;
    const update = () => {
      const day = dailyDay(timeline ? timeline.clock.time() : null);
      raster.show(day ? tileUrl(dailyProduct(day), day) : null);
    };
    update();
    // Live, the day rolls over at midnight UTC.
    const stop = timeline ? followClock(timeline.clock, update) : (() => { const id = setInterval(update, 15 * 60_000); return () => clearInterval(id); })();
    return () => { stop(); raster.destroy(); };
  }, [mapReady, activeLayers.sat_daily, mapStyle, history, replay, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    // History runs over days to decades; the 10-minute archives keep only scattered or recent runs.
    if (!mapReady || !map || !activeLayers.sat_live || history) return;
    installGeosatProtocol(maplibregl.addProtocol);
    const bands = SECTORS.map(sector => ({
      sector,
      raster: datedRaster(map, {
        id: `geosat-${sector.id}`, maxzoom: sector.maxzoom, attribution: sector.attribution,
        before: () => photoBefore(map), bounds: [sector.from, -85.06, sector.to, 85.06],
      }),
    }));
    const ctrl = new AbortController();
    let stop: () => void;
    if (replay) {
      const update = () => { for (const b of bands) b.raster.show(geosatTiles(b.sector.id, replayFrame(replay.clock.time()))); };
      update();
      stop = followClock(replay.clock, update);
    } else {
      const load = () => {
        for (const b of bands) {
          latestSectorFrame(b.sector, ctrl.signal).then(t => b.raster.show(geosatTiles(b.sector.id, t)), () => {});
        }
      };
      load();
      const id = setInterval(load, 5 * 60_000);
      stop = () => clearInterval(id);
    }
    return () => { ctrl.abort(); stop(); for (const b of bands) b.raster.destroy(); };
  }, [mapReady, activeLayers.sat_live, mapStyle, history, replay, mapRef]);
}
