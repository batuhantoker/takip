'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { useIsMobile } from '@/components/ui/use-is-mobile';
import { STORAGE_KEY as STUDIO_KEY } from '@/lib/map/style/style-studio';
import { DEFAULT_LAYOUT, fromStudio, isShown, normalize, type Form, type PageLayout, type Piece } from './lib/model';

const STORAGE_KEY = 'takip.layout';
const listeners = new Set<() => void>();
let current: PageLayout | null = null;

function read(): PageLayout {
  if (current) return current;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    current = saved ? normalize(JSON.parse(saved)) : fromStudio(JSON.parse(localStorage.getItem(STUDIO_KEY) ?? 'null'));
  } catch {
    current = DEFAULT_LAYOUT;
  }
  return current;
}

const notify = () => listeners.forEach(l => l());

/** Every change goes through here: saved at once, and the page follows. */
export function updateLayout(change: (layout: PageLayout) => PageLayout) {
  current = normalize(change(read()));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch { /* private mode: the layout lasts for this visit */ }
  notify();
}

// A change in another tab's Settings reaches this tab's page too.
const onStorage = (e: StorageEvent) => {
  if (e.key !== null && e.key !== STORAGE_KEY) return;
  current = null;
  notify();
};

const subscribe = (listener: () => void) => {
  if (!listeners.size) window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener('storage', onStorage);
  };
};

export const usePageLayout = () => useSyncExternalStore(subscribe, read, () => DEFAULT_LAYOUT);

/** Phones keep a layout of their own. */
export const useLayoutForm = (): Form => (useIsMobile() ? 'phone' : 'desktop');

/** Whether a piece shows, in the layout for the screen in use. */
export function useShown(): (piece: Piece) => boolean {
  const layout = usePageLayout();
  const form = useLayoutForm();
  return useCallback(piece => isShown(layout, form, piece), [layout, form]);
}
