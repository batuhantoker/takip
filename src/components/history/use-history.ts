'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { createHistorySession, type HistorySession } from '@/lib/history/session';

/** History opens on the eve of the First World War, a month a second. */
const START = Date.UTC(1914, 5, 28);

/** The History session while the History tab's mode is on; null shows the live map. Reopening resumes where it left off. */
export function useHistory() {
  const [session, setSession] = useState<HistorySession | null>(null);
  const [families, setFamilies] = useState<string[]>([]);
  // Sessions own timers, so they are made and disposed here rather than in a state updater, which React may run twice.
  const current = useRef<HistorySession | null>(null);
  const resumeAt = useRef(START);
  const unsubscribe = useRef<() => void>(() => {});

  const close = useCallback(() => {
    if (!current.current) return;
    resumeAt.current = current.current.clock.time();
    unsubscribe.current();
    current.current.dispose();
    current.current = null;
    setSession(null);
    setFamilies([]);
  }, []);

  const open = useCallback(() => {
    if (current.current) return;
    const s = createHistorySession(resumeAt.current);
    current.current = s;
    unsubscribe.current = s.subscribe(() => setFamilies(s.families()));
    s.clock.play();
    setSession(s);
    setFamilies(s.families());
  }, []);

  useEffect(() => () => {
    unsubscribe.current();
    current.current?.dispose();
  }, []);
  return { session, families, open, close };
}

/** Re-renders a few times a second while the clock moves, and on every family or country-view change. */
export function useHistoryTick(session: HistorySession, everyMs = 250) {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const kick = () => { timer ??= setTimeout(() => { timer = undefined; rerender(); }, everyMs); };
    const offs = [session.clock.subscribe(kick), session.subscribe(rerender), session.countries.subscribe(rerender)];
    return () => {
      offs.forEach(off => off());
      clearTimeout(timer);
    };
  }, [session, everyMs]);
}
