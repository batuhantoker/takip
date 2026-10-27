'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';

export type View = { x: number; y: number; k: number };

export const MAX_ZOOM = 8;
const HOME: View = { x: 0, y: 0, k: 1 };

/** Zoom and pan over an SVG's `w`×`h` viewBox: buttons, double-click, drag, and the wheel or a trackpad pinch. */
export function usePanZoom(w: number, h: number) {
  const ref = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>(HOME);
  const [width, setWidth] = useState(0);
  const drag = useRef<{ id: number; cx: number; cy: number; from: View } | null>(null);

  const clamp = useCallback((v: View): View => {
    const k = Math.min(MAX_ZOOM, Math.max(1, v.k));
    return { k, x: Math.min(w - w / k, Math.max(0, v.x)), y: Math.min(h - h / k, Math.max(0, v.y)) };
  }, [w, h]);

  /** `fx`, `fy`: the point that stays put, as a fraction of the plot. */
  const zoomBy = useCallback((factor: number, fx = 0.5, fy = 0.5) => setView(v => {
    const k = Math.min(MAX_ZOOM, Math.max(1, v.k * factor));
    return clamp({ k, x: v.x + fx * (w / v.k - w / k), y: v.y + fy * (h / v.k - h / k) });
  }), [clamp, w, h]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const size = new ResizeObserver(() => setWidth(el.getBoundingClientRect().width));
    size.observe(el);
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const dy = Math.max(-40, Math.min(40, e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY));
      zoomBy(Math.exp(-dy * 0.01), (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    };
    // Passive by default in React, and a passive listener can't stop the page from scrolling or zooming.
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      size.disconnect();
      el.removeEventListener('wheel', onWheel);
    };
  }, [zoomBy]);

  const handlers = {
    onPointerDown: (e: PointerEvent<SVGSVGElement>) => {
      if (e.button !== 0 || view.k === 1) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { id: e.pointerId, cx: e.clientX, cy: e.clientY, from: view };
    },
    onPointerMove: (e: PointerEvent<SVGSVGElement>) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      const r = e.currentTarget.getBoundingClientRect();
      setView(clamp({
        k: d.from.k,
        x: d.from.x - ((e.clientX - d.cx) / r.width) * (w / d.from.k),
        y: d.from.y - ((e.clientY - d.cy) / r.height) * (h / d.from.k),
      }));
    },
    onPointerUp: () => { drag.current = null; },
    onPointerCancel: () => { drag.current = null; },
    onDoubleClick: (e: MouseEvent<SVGSVGElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      zoomBy(e.shiftKey ? 0.5 : 2, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    },
  };

  return {
    ref, view, handlers,
    /** The plot's width in CSS pixels, 0 until measured. */
    width,
    viewBox: `${view.x} ${view.y} ${w / view.k} ${h / view.k}`,
    zoomIn: () => zoomBy(2),
    zoomOut: () => zoomBy(0.5),
    reset: () => setView(HOME),
  };
}
