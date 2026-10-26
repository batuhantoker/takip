'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** A row of tabs that scrolls sideways, opened with the current one in view; the page itself never moves. */
export function TabRow({ className, children }: { className?: string; children: ReactNode }) {
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = row.current;
    const here = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (el && here) el.scrollLeft = here.offsetLeft - (el.clientWidth - here.offsetWidth) / 2;
  }, []);
  return <div ref={row} className={className}>{children}</div>;
}
