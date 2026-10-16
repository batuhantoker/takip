'use client';

import { useEffect, useState } from 'react';
import { parseRecent, RECENT_KEY, step, type RecentItem, type ShownAt } from '@/components/shell/showing/lib/recent';

function load(): RecentItem[] {
  try {
    return parseRecent(window.localStorage.getItem(RECENT_KEY));
  } catch {
    return [];
  }
}

/**
 * What the person recently had on and has switched off, from the chip, Layers or History alike: found by comparing
 * the chip's rows from one render to the next, and kept across reloads. `tracking` waits for start-up to restore the
 * saved layers, which would otherwise read as switching the defaults off.
 */
export function useRecent(now: ShownAt, arcgisIds: ReadonlySet<string>, tracking: boolean): RecentItem[] {
  const [recent, setRecent] = useState<RecentItem[]>(load);
  const [last, setLast] = useState<{ key: string; at: ShownAt } | null>(null);
  const key = `${now.mode}|${now.rows.map(r => r.id).join(',')}|${[...arcgisIds].join(',')}`;
  if (tracking && last?.key !== key) {
    setLast({ key, at: now });
    const next = step(recent, last?.at ?? null, now, arcgisIds);
    if (next !== recent) setRecent(next);
  }
  useEffect(() => {
    try { window.localStorage.setItem(RECENT_KEY, JSON.stringify(recent)); } catch { /* storage blocked */ }
  }, [recent]);
  return recent;
}
