'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { HISTORY_FAMILIES } from '@/lib/history/popup';
import { createHistorySession, type HistorySession } from '@/lib/history/session';

/** History opens on the eve of the First World War, a month a second. */
const START = Date.UTC(1914, 5, 28);
const FAMILIES_KEY = 'takip.history.families';

/** The event families picked last visit, if any were saved. */
function restoreFamilies(s: HistorySession) {
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(FAMILIES_KEY) ?? 'null');
    // All off would reopen on a blank map, so that counts as nothing saved.
    if (!Array.isArray(saved) || !saved.length) return;
    for (const family of Object.keys(HISTORY_FAMILIES)) s.setFamily(family, saved.includes(family));
  } catch { /* storage blocked */ }
}

function saveFamilies(families: string[]) {
  try { window.localStorage.setItem(FAMILIES_KEY, JSON.stringify(families)); } catch { /* storage blocked */ }
}

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
    restoreFamilies(s);
    current.current = s;
    // Deep time has no calendar events to draw.
    unsubscribe.current = s.subscribe(() => {
      setFamilies(s.deep() ? [] : s.families());
      saveFamilies(s.families());
    });
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

/** Re-renders a few times a second while either clock moves (unless `clocks` is off), and on every family, country-view or story change. */
export function useHistoryTick(session: HistorySession, { everyMs = 250, clocks = true } = {}) {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const kick = () => { timer ??= setTimeout(() => { timer = undefined; rerender(); }, everyMs); };
    const offs = [
      ...(clocks ? [session.clock.subscribe(kick), session.deepClock.subscribe(kick)] : []),
      session.subscribe(rerender),
      session.countries.subscribe(rerender),
      session.story.subscribe(rerender),
    ];
    return () => {
      offs.forEach(off => off());
      clearTimeout(timer);
    };
  }, [session, everyMs, clocks]);
}
