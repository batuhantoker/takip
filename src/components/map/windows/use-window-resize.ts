'use client';

import { useCallback, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { resizeRect, type Edge } from '@/components/map/windows/lib/geometry';
import { KINDS, limitsFor } from './kinds';
import { getArea } from './map-area';
import { place, unplace } from './use-window-drag';
import { windowStore } from './window-store';

/** Edge and corner resizing, by inline size and transform, committed when the pointer lets go. */
export function useWindowResize(id: string, root: RefObject<HTMLDivElement | null>) {
  return useCallback((edge: Edge) => (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = root.current;
    const me = windowStore.find(id);
    if (e.button !== 0 || !el || !me) return;
    e.stopPropagation();
    const b = el.getBoundingClientRect();
    const start = { x: b.left, y: b.top, w: b.width, h: b.height };
    const area = getArea();
    const video = KINDS[me.kind].video;
    // Header, captions and so on: everything that is not the 16:9 picture.
    const chrome = video ? start.h - (start.w * 9) / 16 : undefined;
    const lim = limitsFor(me.kind, area);
    const px = e.clientX, py = e.clientY;
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    el.classList.add('is-resizing');
    let last = start;

    const move = (ev: PointerEvent) => {
      const r = resizeRect(start, edge, ev.clientX - px, ev.clientY - py,
        { ...lim, maxW: Math.min(lim.maxW, edge.includes('w') ? start.x + start.w - area.left : area.right - start.x),
          maxH: Math.min(lim.maxH, edge.startsWith('n') ? start.y + start.h - area.top : area.bottom - start.y) }, chrome);
      el.style.setProperty('--rw', `${r.w}px`);
      el.style.setProperty('--rmax', 'none');
      if (!video) el.style.setProperty('--rh', `${r.h}px`);
      place(el, r.x, r.y);
      last = r;
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      if (last !== start) windowStore.resize(id, { x: last.x, y: last.y, w: Math.round(last.w), h: video ? null : Math.round(last.h) });
      el.style.removeProperty('--rw');
      el.style.removeProperty('--rh');
      el.style.removeProperty('--rmax');
      unplace(el);
      el.classList.remove('is-resizing');
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  }, [id, root]);
}
