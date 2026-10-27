'use client';

import { useState, useSyncExternalStore } from 'react';
import { viewerZone } from './zone';

/** Hours windows are exact for Home, Growth and Visitors; the tabs kept by day show the last 7 days instead. */
export const RANGES = [
  { id: '6h', label: 'Last 6 hours', unit: 'hours', n: 6 },
  { id: '24h', label: 'Last 24 hours', unit: 'hours', n: 24 },
  { id: '3d', label: 'Last 3 days', unit: 'hours', n: 72 },
  { id: '7d', label: 'Last 7 days', unit: 'days', n: 7 },
  { id: '30d', label: 'Last 30 days', unit: 'days', n: 30 },
  { id: '90d', label: 'Last 90 days', unit: 'days', n: 90 },
] as const;
export type RangeId = (typeof RANGES)[number]['id'];

// Kept for the page's life, so the pick follows you from area to area.
let picked: RangeId = '30d';
const listeners = new Set<() => void>();
const subscribe = (notify: () => void) => {
  listeners.add(notify);
  return () => listeners.delete(notify);
};
const pick = (id: RangeId) => {
  picked = id;
  listeners.forEach(notify => notify());
};

// Admins' own visits and accounts are left out everywhere but Live, where they show marked.
const ADMINS = 'admins=exclude';

export type Range = ReturnType<typeof useRange>;

/** The analytics range as query strings: `range` for the endpoints that go down to the hour, `dayRange` for the ones kept by day. */
export function useRange() {
  const span = useSyncExternalStore(subscribe, () => picked, () => picked);
  const [refreshes, setRefreshes] = useState(0);
  const range = RANGES.find(r => r.id === span)!;
  // The viewer's zone: Visitors counts its days from their midnight; the tables kept by UTC day ignore it.
  const tz = `tz=${encodeURIComponent(viewerZone())}`;
  // Refresh makes every address new, so each card asks again; the api drops n. Not ?refresh=1: that redoes the slow disk scans.
  const again = refreshes ? `&n=${refreshes}` : '';
  const hours = range.unit === 'hours' ? range.n : null;
  return {
    span, hours, refreshes,
    setSpan: pick,
    refresh: () => setRefreshes(n => n + 1),
    range: `?${range.unit}=${range.n}&${ADMINS}&${tz}${again}`,
    dayRange: hours ? `?days=7&${ADMINS}&${tz}${again}` : `?${range.unit}=${range.n}&${ADMINS}&${tz}${again}`,
  };
}
