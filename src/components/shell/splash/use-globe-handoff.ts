'use client';

import { useEffect, useState, type RefObject } from 'react';
import { mapGlobe, splashGlobeRadius } from './map-handoff';

/** The move that lands the splash globe on the map's opening globe, which fills the viewport behind it. */
export function useGlobeHandoff(ref: RefObject<HTMLElement | null>) {
  const [target, setTarget] = useState({ x: 0, y: 0, scale: 1 });
  useEffect(() => {
    const el = ref.current;
    const stage = el?.offsetParent;
    if (!el || !(stage instanceof HTMLElement)) return;
    // offset* ignore transforms, so the intro scale doesn't skew the measurement.
    const measure = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (!w || !h) return;
      const map = mapGlobe(stage.clientWidth, stage.clientHeight);
      setTarget({
        x: map.cx - (el.offsetLeft + w / 2),
        y: map.cy - (el.offsetTop + h / 2),
        scale: map.r / splashGlobeRadius(w, h),
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [ref]);
  return target;
}
