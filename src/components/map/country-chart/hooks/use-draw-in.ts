'use client';

import { type RefObject, useEffect } from 'react';

/**
 * Draws a line in once, left to right at one pace across the whole time axis, so a run that starts later
 * starts drawing later. Paths with `pathLength=1` are stroked in; anything else marked `data-from` (dashed
 * projections, the head dot) fades in when the pen reaches it. `data-from`/`data-to` are 0–1 along the axis.
 */
export function useDrawIn(ref: RefObject<SVGGElement | null>, ms = 1200) {
  useEffect(() => {
    const g = ref.current;
    if (!g || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const anims = [...g.querySelectorAll<SVGElement>('[data-from]')].map(el => {
      const from = Number(el.dataset.from);
      const to = Number(el.dataset.to ?? from);
      const timing: KeyframeAnimationOptions = { delay: from * ms, duration: Math.max(120, (to - from) * ms), easing: 'linear', fill: 'backwards' };
      return el.hasAttribute('pathLength')
        ? el.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], timing)
        : el.animate([{ opacity: 0 }, { opacity: 1 }], timing);
    });
    return () => anims.forEach(a => a.cancel());
  }, [ref, ms]);
}
