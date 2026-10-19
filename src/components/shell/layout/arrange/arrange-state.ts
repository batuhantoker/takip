'use client';

import { useSyncExternalStore } from 'react';

let arranging = false;
const listeners = new Set<() => void>();

const set = (next: boolean) => {
  if (next === arranging) return;
  arranging = next;
  listeners.forEach(l => l());
};

/** Arrange mode, started from Settings → Layout: the map's pieces outlined, to be dragged anywhere. */
export const startArranging = () => set(true);
export const stopArranging = () => set(false);

export function useArranging() {
  return useSyncExternalStore(
    l => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => arranging,
    () => false,
  );
}
