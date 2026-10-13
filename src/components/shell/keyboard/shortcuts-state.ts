'use client';

import { useSyncExternalStore } from 'react';

let open = false;
const listeners = new Set<() => void>();

const set = (next: boolean) => {
  if (next === open) return;
  open = next;
  listeners.forEach(l => l());
};

/** The keyboard cheat sheet, opened from the status bar, the More menu or the ? key. */
export const showShortcuts = () => set(true);
export const hideShortcuts = () => set(false);
export const toggleShortcuts = () => set(!open);

export function useShortcutsOpen() {
  return useSyncExternalStore(
    l => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => open,
    () => false,
  );
}
