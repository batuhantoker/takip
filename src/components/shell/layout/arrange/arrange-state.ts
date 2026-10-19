'use client';

import { useSyncExternalStore } from 'react';
import type { Anchor, OverlayId } from '../lib/model';
import type { Box } from '../lib/spot';

/** The piece being dragged, its size, and where it would snap to if dropped now: a preset, or beside another piece. */
export interface Dragging {
  id: OverlayId;
  width: number;
  height: number;
  snap: { box: Box; preset: Anchor | null } | null;
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

const sameSnap = (a: Dragging['snap'], b: Dragging['snap']) =>
  a === b || (!!a && !!b && a.preset === b.preset && a.box.left === b.box.left && a.box.top === b.box.top);

// Called on every pointer move: only a change of target re-renders anything.
export function setDragging(next: Dragging | null) {
  if (next?.id === dragging?.id && next?.width === dragging?.width && next?.height === dragging?.height && sameSnap(next?.snap ?? null, dragging?.snap ?? null)) return;
  dragging = next;
  notify();
}

export const useArranging = () => useSyncExternalStore(subscribe, () => arranging, () => false);
export const useDragging = () => useSyncExternalStore(subscribe, () => dragging, () => null);
