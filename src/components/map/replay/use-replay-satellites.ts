'use client';

import { useEffect, useRef } from 'react';
import type { ActiveLayers } from '@/lib/map/layers/defaults';
import type { ReplaySession } from '@/lib/map/replay/session';
import { SATELLITE_ELEMENTS_URL, satelliteData } from '@/lib/feeds/satellites/elements';

/**
 * The satellite catalogue for replay, with its element sets, loaded once: use-satellite-motion moves it
 * with the clock from there. The live set again once replay closes.
 */
export function useReplaySatellites({ replay, activeLayers, fetchEndpoint }: {
  replay: ReplaySession | null;
  activeLayers: ActiveLayers;
  fetchEndpoint: (url: string, transform?: (d: any) => any, options?: RequestInit) => Promise<boolean>;
}) {
  const enabled = activeLayers.satellites || activeLayers.sat_comms || activeLayers.sat_military || activeLayers.sat_navigation || activeLayers.sat_earth || activeLayers.sat_science;
  const seq = useRef(0);
  const shownReplay = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    // Today's sets placed at `at` (epoch ms), or now.
    const load = (at?: number) => {
      const mine = ++seq.current;
      // A slow answer must not land over a newer one: live over replay's, or replay's over live.
      void fetchEndpoint(SATELLITE_ELEMENTS_URL, d => (mine === seq.current ? satelliteData(d, new Date(Math.min(at ?? Date.now(), Date.now()))) : {}), { cache: 'no-cache' });
    };
    if (!replay) {
      if (shownReplay.current) load();
      shownReplay.current = false;
      return;
    }
    shownReplay.current = true;
    load(replay.clock.time());
  }, [replay, enabled, fetchEndpoint]);
}
