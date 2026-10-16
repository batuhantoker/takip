'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { datedRaster } from '@/lib/feeds/imagery/dated-raster';
import {
  RADAR_ATTRIBUTION, RADAR_MAX_ZOOM, RADAR_TILE_SIZE, radarFrameAt, radarFrames, radarState, setRadarState, subscribeRadar,
  type RadarFrame, type RadarMode,
} from '@/lib/feeds/weather/radar';
import { stackGroundRasters } from '@/lib/map/basemap/ground-rasters';
import { followClock } from '@/lib/map/replay/follow';
import type { ReplayClock } from '@/lib/map/replay/clock';
import type { MapRef, WorldMapProps } from '@/components/map/types';

/** A loop step, and the pause on the newest frame before it starts over. */
const STEP_MS = 500;
const HOLD_MS = 1500;

interface RadarArgs {
  mapRef: MapRef;
  mapReady: boolean;
  activeLayers: WorldMapProps['activeLayers'];
  mapStyle: string;
  replay: { clock: ReplayClock } | null;
}

/**
 * Precipitation radar (RainViewer): the newest frame live, the last two hours on a loop when the person
 * plays it, or the frame at Replay's time while Replay is open. Frames swap without a blank map.
 */
export function useRadarLayer({ mapRef, mapReady, activeLayers, mapStyle, replay }: RadarArgs) {
  const looping = useSyncExternalStore(subscribeRadar, () => radarState().looping, () => false);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !activeLayers.wx_radar) return;
    const raster = datedRaster(map, { id: 'wx-radar', maxzoom: RADAR_MAX_ZOOM, tileSize: RADAR_TILE_SIZE, attribution: RADAR_ATTRIBUTION, before: () => 'day-night-fill', opacity: 0.75 });
    const ctrl = new AbortController();
    let frames: RadarFrame[] = [];
    let stop = () => {};

    const show = (frame: RadarFrame | null, mode: RadarMode) => {
      raster.show(frame?.tiles ?? null);
      stackGroundRasters(map);
      setRadarState({ mode, frameTime: frame?.time ?? null });
    };
    const start = () => {
      stop();
      setRadarState({ from: frames[0]?.time ?? null, to: frames.at(-1)?.time ?? null });
      if (replay) {
        const update = () => show(radarFrameAt(frames, replay.clock.time()), 'replay');
        update();
        stop = followClock(replay.clock, update);
      } else if (looping && frames.length > 1) {
        let i = 0;
        let timer: ReturnType<typeof setTimeout>;
        const step = () => {
          show(frames[i], 'loop');
          const last = i === frames.length - 1;
          i = last ? 0 : i + 1;
          timer = setTimeout(step, last ? HOLD_MS : STEP_MS);
        };
        step();
        stop = () => clearTimeout(timer);
      } else {
        show(frames.at(-1) ?? null, 'live');
      }
    };
    const load = async () => {
      try {
        const next = await radarFrames(ctrl.signal);
        if (ctrl.signal.aborted || !next.length || next.at(-1)!.time === frames.at(-1)?.time) return;
        frames = next;
        start();
      } catch (e) {
        if (!ctrl.signal.aborted) console.warn('[TAKIP] Radar frames failed:', e instanceof Error ? e.message : e);
      }
    };
    load();
    // RainViewer publishes a frame every 10 minutes.
    const refresh = setInterval(load, 5 * 60_000);
    return () => {
      ctrl.abort();
      clearInterval(refresh);
      stop();
      raster.destroy();
      setRadarState({ mode: 'live', frameTime: null });
    };
  }, [mapReady, activeLayers.wx_radar, mapStyle, mapRef, replay, looping]);
}
