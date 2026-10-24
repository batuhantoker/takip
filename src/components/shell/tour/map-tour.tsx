'use client';

import { useEffect, useEffectEvent, useRef, type Dispatch, type SetStateAction } from 'react';
import type { ToolId } from '@/components/shell/sidebar/dock';
import { STOPS } from './lib/stops';
import { TourLayer } from './parts/tour-layer';
import { endTour, useTourAt } from './tour-state';

/**
 * The map tour (desktop). Each stop shows its panel only where that leaves the map as it was, and the
 * panel that was open comes back at the end.
 */
export default function MapTour({ activeTool, setActiveTool, onStart }: {
  activeTool: ToolId | null;
  setActiveTool: Dispatch<SetStateAction<ToolId | null>>;
  /** Clears what would cover the map, such as TI's workspace or the space view. */
  onStart: () => void;
}) {
  const at = useTourAt();
  /** The panel open when the tour began; undefined while it is off. */
  const before = useRef<ToolId | null | undefined>(undefined);

  const follow = useEffectEvent((i: number | null) => {
    if (i === null) {
      if (before.current !== undefined) setActiveTool(before.current);
      before.current = undefined;
      return;
    }
    if (before.current === undefined) {
      before.current = activeTool;
      onStart();
    }
    const { tool, opens } = STOPS[i];
    setActiveTool(tool && (opens || before.current === tool) ? tool : null);
  });
  useEffect(() => follow(at), [at]);
  useEffect(() => endTour, []);

  return at === null ? null : <TourLayer at={at} />;
}
