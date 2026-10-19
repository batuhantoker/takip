'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { createReplaySession, type ReplaySession } from '@/lib/map/replay/session';
import { countAction } from '@/lib/platform/usage-actions';

/** Replay opens an hour back, playing at a minute per second, so there is movement at once. */
const START_BACK_MS = 60 * 60_000;

/** The replay session while replay is on; null shows the live map. */
export function useReplay() {
  const [session, setSession] = useState<ReplaySession | null>(null);
  // Sessions own timers, so they are made and disposed here rather than in a state updater, which React may run twice.
  const current = useRef<ReplaySession | null>(null);
  const toggle = useCallback(() => {
    if (current.current) {
      current.current.dispose();
      current.current = null;
    } else {
      countAction('replay.start');
      current.current = createReplaySession(Date.now() - START_BACK_MS);
      current.current.clock.play();
    }
    setSession(current.current);
  }, []);
  useEffect(() => () => current.current?.dispose(), []);
  return { session, toggle };
}

/** Re-renders a few times a second while the clock moves, and on every manifest or stats change. */
export function useReplayTick(session: ReplaySession, everyMs = 250) {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [now, setNow] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const kick = () => {
      timer ??= setTimeout(() => {
        timer = undefined;
        setNow(Date.now());
        rerender();
      }, everyMs);
    };
    const offClock = session.clock.subscribe(kick);
    const offSession = session.subscribe(kick);
    const clock = setInterval(kick, 1000);
    kick();
    return () => {
      offClock();
      offSession();
      clearInterval(clock);
      clearTimeout(timer);
    };
  }, [session, everyMs]);
  return now;
}
