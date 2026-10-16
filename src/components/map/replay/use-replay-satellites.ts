'use client';

import { useEffect, useRef } from 'react';
import type { ActiveLayers } from '@/lib/map/layers/defaults';
import type { ReplaySession } from '@/lib/map/replay/session';

/**
 * The satellite catalogue for replay, with its element sets, loaded once: use-satellite-motion moves it
 * with the clock from there. The live set again once replay closes.
 */
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
      // A slow answer must not land over a newer one: live over replay's, or replay's over live.
      void fetchEndpoint(url, d => (mine === seq.current ? { ...d, satellites_at: d.timestamp } : {}));
    };
    if (!replay) {
      if (shownReplay.current) load('/api/satellites?tle=1');
      shownReplay.current = false;
      return;
    }
    shownReplay.current = true;
    load(`/api/satellites?tle=1&at=${Math.round(replay.clock.time() / 1000)}`);
  }, [replay, enabled, fetchEndpoint]);
}
