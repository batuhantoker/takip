'use client';

import { useEffect, useRef } from 'react';
import type { ActiveLayers } from '@/lib/layers/defaults';
import type { ReplaySession } from '@/lib/replay/session';

/** The route answers in whole minutes, so a smaller move fetches the same positions. */
const STEP_MS = 60_000;
/** Each answer propagates every catalogued object, so playback asks at most this often. */
const PLAYING_EVERY_MS = 3_000;
const SEEK_SETTLE_MS = 250;

/** Satellites where they were at the replay clock's time, and the live set again once replay closes. */
export function useReplaySatellites({ replay, activeLayers, fetchEndpoint }: {
  replay: ReplaySession | null;
  activeLayers: ActiveLayers;
  fetchEndpoint: (url: string, transform?: (d: any) => any) => Promise<boolean>;
}) {
  const enabled = activeLayers.satellites || activeLayers.sat_comms || activeLayers.sat_military || activeLayers.sat_navigation || activeLayers.sat_earth || activeLayers.sat_science;
  const seq = useRef(0);
  const shownReplay = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const load = (url: string) => {
      const mine = ++seq.current;
      // A slow answer for an earlier time must not land over a newer one.
      void fetchEndpoint(url, d => (mine === seq.current ? { ...d, satellites_at: d.timestamp } : {}));
    };
    if (!replay) {
      if (shownReplay.current) load('/api/satellites');
      shownReplay.current = false;
      return;
    }
    shownReplay.current = true;
    const { clock } = replay;
    let lastT = -Infinity;
    let lastWall = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const request = () => {
      clearTimeout(timer);
      timer = undefined;
      lastT = clock.time();
      lastWall = Date.now();
      load(`/api/satellites?at=${Math.round(lastT / STEP_MS) * (STEP_MS / 1000)}`);
    };
    const onChange = () => {
      if (Math.abs(clock.time() - lastT) < STEP_MS) return;
      // Paused, every change is a seek: wait for the scrubber to settle rather than the playback throttle.
      if (!clock.playing()) {
        clearTimeout(timer);
        timer = setTimeout(request, SEEK_SETTLE_MS);
        return;
      }
      timer ??= setTimeout(request, Math.max(0, PLAYING_EVERY_MS - (Date.now() - lastWall)));
    };
    request();
    const off = clock.subscribe(onChange);
    return () => {
      off();
      clearTimeout(timer);
    };
  }, [replay, enabled, fetchEndpoint]);
}
