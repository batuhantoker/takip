'use client';

import { useEffect } from 'react';
import { datedRaster } from '@/lib/feeds/imagery/dated-raster';
import { LIGHTNING_ATTRIBUTION, LIGHTNING_MAX_ZOOM, lightningFrameAt, lightningTiles, lightningTimes } from '@/lib/feeds/weather/lightning';
import { stackGroundRasters } from '@/lib/map/basemap/ground-rasters';
import { followClock } from '@/lib/map/replay/follow';
import type { ReplayClock } from '@/lib/map/replay/clock';
import type { MapRef, WorldMapProps } from '@/components/map/types';

interface LightningArgs {
  mapRef: MapRef;
  mapReady: boolean;
  activeLayers: WorldMapProps['activeLayers'];
  mapStyle: string;
  replay: { clock: ReplayClock } | null;
}

/** Lightning strike density (NOAA nowCOAST): the newest 15 minutes live, or the frame at Replay's time within the last six hours. */
export function useLightningLayer({ mapRef, mapReady, activeLayers, mapStyle, replay }: LightningArgs) {
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !activeLayers.wx_lightning) return;
    const raster = datedRaster(map, { id: 'wx-lightning', maxzoom: LIGHTNING_MAX_ZOOM, attribution: LIGHTNING_ATTRIBUTION, before: () => 'day-night-fill', opacity: 0.9 });
    const ctrl = new AbortController();
    let times: number[] = [];
    let stop = () => {};

    const show = (time: number | null) => {
      raster.show(time == null ? null : lightningTiles(time));
      stackGroundRasters(map);
    };
    const load = async () => {
      try {
        const next = await lightningTimes(ctrl.signal);
        if (ctrl.signal.aborted || !next.length || next.at(-1) === times.at(-1)) return;
        times = next;
        stop();
        if (replay) {
          const update = () => show(lightningFrameAt(times, replay.clock.time()));
          update();
          stop = followClock(replay.clock, update);
        } else {
          show(times.at(-1)!);
        }
      } catch (e) {
        if (!ctrl.signal.aborted) console.warn('[TAKIP] Lightning frames failed:', e instanceof Error ? e.message : e);
      }
    };
    load();
    // A frame lands every 15 minutes.
    const refresh = setInterval(load, 5 * 60_000);
    return () => { ctrl.abort(); clearInterval(refresh); stop(); raster.destroy(); };
  }, [mapReady, activeLayers.wx_lightning, mapStyle, mapRef, replay]);
}
