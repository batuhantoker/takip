'use client';

import { useSyncExternalStore } from 'react';
import type { Anchor, OverlayId } from '../lib/model';

/** The piece being dragged, its size, and the preset place it would take if dropped now. */
export interface Dragging {
  id: OverlayId;
  width: number;
  height: number;
  snap: Anchor | null;
}

let arranging = false;
let dragging: Dragging | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Arrange mode, started from Settings → Layout: the map's pieces outlined, to be dragged anywhere. */
export const startArranging = () => {
  if (arranging) return;
  arranging = true;
  notify();
};
export const stopArranging = () => {
  if (!arranging) return;
  arranging = false;
  dragging = null;
  notify();
};

export function setDragging(next: Dragging | null) {
  if (next?.id === dragging?.id && next?.snap === dragging?.snap && next?.width === dragging?.width && next?.height === dragging?.height) return;
  dragging = next;
  notify();
}

export const useArranging = () => useSyncExternalStore(subscribe, () => arranging, () => false);
export const useDragging = () => useSyncExternalStore(subscribe, () => dragging, () => null);
