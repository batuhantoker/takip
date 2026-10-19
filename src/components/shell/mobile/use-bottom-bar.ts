'use client';

import { useEffect, useState } from 'react';

/** The phone's bottom bar height (the shell's Tools nav), measured, so sheets sit on top of it. */
export function useBottomBar(active: boolean): number {
  const [height, setHeight] = useState(56);
  useEffect(() => {
    if (!active) return;
    const nav = document.querySelector<HTMLElement>('nav[data-bottom-bar]');
    if (!nav) return;
    const measure = () => setHeight(Math.max(0, Math.round(window.innerHeight - nav.getBoundingClientRect().top)));
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(nav);
    window.addEventListener('resize', measure);
    return () => { watch.disconnect(); window.removeEventListener('resize', measure); };
  }, [active]);
  return height;
}
