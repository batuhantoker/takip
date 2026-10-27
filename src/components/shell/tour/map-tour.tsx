'use client';

import { useEffect, useEffectEvent, useRef, type Dispatch, type SetStateAction } from 'react';
import type { ToolId } from '@/components/shell/sidebar/dock';
import { STOPS } from './lib/stops';
import { TourLayer } from './parts/tour-layer';
import { quitTour, useTourAt, useTourName, useTourPart } from './tour-state';

/**
 * The map tour (desktop). Each stop shows its panel only where that leaves the map as it was, unless the
 * person asks to see inside it: History then starts, and ends again on the next stop. Stopping leaves
 * things as the tour showed them, so the panel in view stays open.
 */
export default function MapTour({ activeTool, setActiveTool, onStart, history }: {
  activeTool: ToolId | null;
  setActiveTool: Dispatch<SetStateAction<ToolId | null>>;
  /** Clears what would cover the map, such as TI's workspace or the space view. */
  onStart: () => void;
  history: { running: boolean; start: () => void; exit: () => void };
}) {
  // The space view runs its own tour on the same layer; this one leaves it alone.
  const mine = useTourName() === 'map';
  const tourAt = useTourAt();
  const at = mine ? tourAt : null;
  const part = useTourPart();
  /** The panel open when the tour began, kept open on its own stop; undefined while the tour is off. */
  const before = useRef<ToolId | null | undefined>(undefined);
  /** History started by the tour, to end when it moves on. */
  const startedHistory = useRef(false);

  const follow = useEffectEvent((i: number | null, p: number | null) => {
    if (i === null) {
      before.current = undefined;
      startedHistory.current = false;
      return;
    }
    if (before.current === undefined) {
      before.current = activeTool;
      onStart();
    }
    const { tool, opens } = STOPS[i];
    const show = tool && (p !== null || opens || before.current === tool) ? tool : null;
    if (show === 'history' && !history.running) {
      history.start();
      startedHistory.current = true;
    } else if (show !== 'history' && startedHistory.current) {
      history.exit();
      startedHistory.current = false;
    }
    setActiveTool(show);
  });
  useEffect(() => follow(at, part), [at, part]);
  // Quietly: a window narrowed to a phone's width isn't someone skipping.
  useEffect(() => () => quitTour('map'), []);

  return at === null ? null : <TourLayer at={at} />;
}
