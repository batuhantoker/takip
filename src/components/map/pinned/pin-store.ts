'use client';

import { useSyncExternalStore } from 'react';
import { windowStore } from '@/components/map/windows';

/** A popup pinned as a window: its content node moves into the window and keeps updating there. */
export interface Pin {
  /** The window's id; pinning the same one again brings that window forward. */
  id: string;
  label: string;
  kicker: string;
  dot: string;
  /** [lng, lat] */
  at: [number, number];
  node: HTMLElement;
  /** Stops the content's updates once it leaves the screen. */
  release: () => void;
}

let pins: Pin[] = [];
let enabled = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export const pinStore = {
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  list: () => pins,
  /** Whether a popup offers Pin: only while windows are on the screen (not on a phone). */
  enabled: () => enabled,
  setEnabled(on: boolean) {
    enabled = on;
    if (!on) pinStore.clear();
  },

  pin(p: Pin) {
    if (pins.some(q => q.id === p.id)) {
      p.release();
      windowStore.expand(p.id);
      return;
    }
    pins = [...pins, p];
    emit();
  },

  unpin(id: string) {
    const p = pins.find(q => q.id === id);
    if (!p) return;
    pins = pins.filter(q => q !== p);
    p.release();
    emit();
  },

  clear() {
    if (!pins.length) return;
    const gone = pins;
    pins = [];
    gone.forEach(p => p.release());
    emit();
  },
};

export const usePins = () => useSyncExternalStore(pinStore.subscribe, pinStore.list, pinStore.list);
