'use client';

import { useEffect, useRef } from 'react';
import type { ActiveLayers } from '@/lib/map/layers/defaults';
import { needsLive } from '@/lib/map/layers/past';

/** Turning on a layer the past view can't show leaves History or Replay for the live map, where it can. */
export function useBackToLive({ activeLayers, past, exitPast }: {
  activeLayers: ActiveLayers;
  past: 'history' | 'replay' | null;
  exitPast: () => void;
}) {
  const previous = useRef(activeLayers);
  useEffect(() => {
    const before = previous.current as Record<string, unknown>;
    previous.current = activeLayers;
    if (!past) return;
    const now = activeLayers as Record<string, unknown>;
    if (Object.keys(now).some(layer => now[layer] === true && before[layer] !== true && needsLive(layer, past))) exitPast();
    // Only a change of layers decides this; entering or leaving the past alone does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayers]);
}
