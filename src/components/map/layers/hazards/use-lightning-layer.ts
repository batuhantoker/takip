'use client';

import { useEffect } from 'react';
import { datedRaster } from '@/lib/feeds/imagery/dated-raster';
import { LIGHTNING_MAX_ZOOM, LIGHTNING_SOURCES, lightningFrameAt, lightningTiles, lightningTimes, type LightningSource } from '@/lib/feeds/weather/lightning';
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

/**
 * Lightning from NOAA nowCOAST and EUMETSAT's Lightning Imager, each in its own longitudes: the newest frame live,
 * or the frame at Replay's time within the last six hours.
 */
export function useLightningLayer({ mapRef, mapReady, activeLayers, mapStyle, replay }: LightningArgs) {
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !activeLayers.wx_lightning) return;
    const ctrl = new AbortController();

    const follow = (source: LightningSource) => {
      const rasters = (source.bounds ?? [undefined]).map((bounds, i) => datedRaster(map, {
        id: `wx-lightning-${source.id}${i ? `-${i}` : ''}`, maxzoom: LIGHTNING_MAX_ZOOM, attribution: source.attribution,
        before: () => 'day-night-fill', opacity: 0.9, bounds,
      }));
      let times: number[] = [];
      let stop = () => {};
      const show = (time: number | null) => {
        const url = time == null ? null : lightningTiles(source, time);
        rasters.forEach(r => r.show(url));
        stackGroundRasters(map);
      };
      const load = async () => {
        try {
          const next = await lightningTimes(source, ctrl.signal);
          if (ctrl.signal.aborted || !next.length || next.at(-1) === times.at(-1)) return;
          times = next;
          stop();
          if (replay) {
            const update = () => show(lightningFrameAt(times, replay.clock.time(), source.spanMs));
            update();
            stop = followClock(replay.clock, update);
          } else {
            show(times.at(-1)!);
          }
        } catch (e) {
          if (!ctrl.signal.aborted) console.warn(`[TAKIP] Lightning frames (${source.id}) failed:`, e instanceof Error ? e.message : e);
        }
      };
      load();
      // nowCOAST adds a frame every 15 minutes, EUMETView every 5.
      const refresh = setInterval(load, 5 * 60_000);
      return () => { clearInterval(refresh); stop(); rasters.forEach(r => r.destroy()); };
    };

    const stops = LIGHTNING_SOURCES.map(follow);
    return () => { ctrl.abort(); stops.forEach(s => s()); };
  }, [mapReady, activeLayers.wx_lightning, mapStyle, mapRef, replay]);
}
