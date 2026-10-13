'use client';

import { useCallback, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { clampRect, snapRect, type Rect } from '@/components/map/windows/lib/geometry';
import { drawGuides } from '@/components/map/windows/lib/guides';
import { getArea } from './map-area';
import { columnSlots, windowStore } from './window-store';

const rectOf = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};
export const windowEl = (id: string) => document.querySelector<HTMLElement>(`[data-window="${CSS.escape(id)}"]`);

/** Moves a window by its own transform, outside React, until the pointer lets go. */
export const place = (el: HTMLElement, x: number, y: number) => {
  el.style.setProperty('--dx', `${x}px`);
  el.style.setProperty('--dy', `${y}px`);
};
export const unplace = (el: HTMLElement) => {
  el.style.removeProperty('--dx');
  el.style.removeProperty('--dy');
};

/** Did the pointer go down on a header, and not on one of its controls? */
export const onHeader = (t: EventTarget | null) =>
  t instanceof Element && !t.closest('button, a, input, select, textarea, [role="slider"]') && !!t.closest('header');

/**
 * Header drag: snaps to neighbours and the map's edges (Alt turns that off), carries the
 * windows snapped to it, and docks when dropped on the column. A press without a drag is a click.
 */
export function useWindowDrag(id: string, root: RefObject<HTMLDivElement | null>, onClick: () => void) {
  return useCallback((e: ReactPointerEvent) => {
    const el = root.current;
    if (e.button !== 0 || !el || !onHeader(e.target)) return;
    const me = windowStore.find(id);
    if (!me) return;
    const start = rectOf(el);
    const area = getArea();
    const members = me.anchor ? [] : windowStore.get().list.filter(w => w.anchor === id)
      .map(w => ({ id: w.id, el: windowEl(w.id), r: windowEl(w.id) ? rectOf(windowEl(w.id)!) : null }))
      .filter((m): m is { id: string; el: HTMLElement; r: Rect } => !!m.el && !!m.r);
    const others = windowStore.get().list
      .filter(w => w.id !== id && !w.docked && !members.some(m => m.id === w.id))
      .map(w => ({ id: w.id, el: windowEl(w.id) }))
      .filter((o): o is { id: string; el: HTMLElement } => !!o.el)
      .map(o => ({ id: o.id, ...rectOf(o.el) }));
    // The group moves as one block, kept inside the map together.
    const all = [start, ...members.map(m => m.r)];
    const block = { x: Math.min(...all.map(r => r.x)), y: Math.min(...all.map(r => r.y)) };
    const blockW = Math.max(...all.map(r => r.x + r.w)) - block.x, blockH = Math.max(...all.map(r => r.y + r.h)) - block.y;
    const px = e.clientX, py = e.clientY;
    let moved = false;
    let last = { x: start.x, y: start.y, attach: null as string | null, dock: false };
    // Where the docked stack ends without this window: dropping by its top re-docks.
    const slots = columnSlots({ ...windowStore.get(), list: windowStore.get().list.filter(w => w.id !== id) }, area);
    const stackEnd = slots.length ? slots[slots.length - 1].y + slots[slots.length - 1].h : area.colTop;

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - px, dy = ev.clientY - py;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      if (!moved) {
        moved = true;
        // Captured only once it is a drag, so a click or double-click still lands on the header.
        el.setPointerCapture(ev.pointerId);
        for (const n of [el, ...members.map(m => m.el)]) n.classList.add('is-dragging');
      }
      const b = clampRect({ x: block.x + dx, y: block.y + dy, w: blockW, h: blockH }, area);
      let r = { ...start, x: start.x + (b.x - block.x), y: start.y + (b.y - block.y) };
      let guides: ReturnType<typeof snapRect>['guides'] = [];
      let attach: string | null = null;
      if (!ev.altKey) {
        const s = snapRect(r, others, area);
        r = { ...r, x: s.x, y: s.y };
        ({ guides, attach } = s);
      }
      const dock = !members.length && Math.abs(r.x + r.w - area.colRight) < 40 && r.y < stackEnd + 40;
      place(el, r.x, r.y);
      for (const m of members) place(m.el, m.r.x + r.x - start.x, m.r.y + r.y - start.y);
      drawGuides(dock ? [] : guides, dock ? { x: area.colRight - start.w, y: area.colTop, w: start.w, h: Math.min(start.h, area.colBottom - area.colTop) } : null);
      last = { x: r.x, y: r.y, attach: dock ? null : attach, dock };
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      drawGuides([], null);
      if (!moved) { onClick(); return; }
      if (last.dock) windowStore.dock(id);
      else windowStore.moveGroup(id, last.x, last.y,
        members.map(m => ({ id: m.id, x: m.r.x + last.x - start.x, y: m.r.y + last.y - start.y })), last.attach);
      // The store now holds the spot; hand the transform back to it.
      for (const n of [el, ...members.map(m => m.el)]) { unplace(n); n.classList.remove('is-dragging'); }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }, [id, root, onClick]);
}
