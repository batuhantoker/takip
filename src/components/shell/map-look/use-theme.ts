'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { applySettings, loadSavedSettings } from '@/lib/map/style/style-studio';

export type ThemeId = 'core' | 'ghost';

const STORAGE_KEY = 'takip.theme';
const listeners = new Set<() => void>();
let current: ThemeId | null = null;

function getTheme(): ThemeId {
  if (current) return current;
  try {
    current = localStorage.getItem(STORAGE_KEY) === 'ghost' ? 'ghost' : 'core';
  } catch {
    current = 'core';
  }
  return current;
}

/** One theme for every control that offers it: Map options, the phone's layer list and Settings. */
export function setTheme(next: ThemeId) {
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch { /* private mode: the choice lasts for this visit */ }
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

export const useThemeId = () => useSyncExternalStore(subscribe, getTheme, () => 'core' as const);

/** Core or Ghost, as a class on <body>, plus any saved Style Studio overrides. Mount once, in the page. */
export function useTheme() {
  const theme = useThemeId();

  useEffect(() => {
    document.body.classList.toggle('theme-ghost', theme === 'ghost');
  }, [theme]);

  /* Style Studio overrides are inline on <body>, so they survive the theme
     swap above and only need reapplying once per load. */
  useEffect(() => {
    const saved = loadSavedSettings();
    if (saved) applySettings(saved);
  }, []);

  return [theme, setTheme] as const;
}
