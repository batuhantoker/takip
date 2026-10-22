'use client';

import { useEffect } from 'react';
import { reportMapMinute } from '@/components/site/page-view';
import { shownPage } from '@/lib/platform/visitor';

const MINUTE = 60_000;

/** The public page framing this embed, when it is one of ours; another site's frame can't be read and books nothing. */
function hostPage(): string | null {
  try {
    if (window.parent === window || window.parent.location.origin !== location.origin) return null;
  } catch {
    return null;
  }
  const page = shownPage();
  return page && page !== '/' ? page : null;
}

/**
 * On our own pages, books a minute for each minute the reader moves, zooms or clicks this small map: the first touch
 * books one, and the next books another once a minute has passed. Only touches count, never the time it is on screen.
 * A finger counts when it lifts: one the browser took for scrolling the page past the map is cancelled first.
 */
export function usePageMapTime() {
  useEffect(() => {
    let booked = -Infinity;
    const scrolled = new Set<number>();
    const book = () => {
      const now = Date.now();
      if (now - booked < MINUTE) return;
      const page = hostPage();
      if (!page) return;
      booked = now;
      reportMapMinute(page);
    };
    const touch = (e: Event) => {
      if (!(e instanceof PointerEvent)) return book();
      if (e.pointerType === 'touch') {
        if (e.type === 'pointerdown') scrolled.delete(e.pointerId);
        else if (e.type === 'pointercancel') scrolled.add(e.pointerId);
        else if (e.type === 'pointerup' && !scrolled.delete(e.pointerId)) book();
        return;
      }
      if (e.type === 'pointerdown' || (e.type === 'pointermove' && e.buttons)) book();
    };
    const kinds = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'wheel', 'keydown'] as const;
    for (const kind of kinds) window.addEventListener(kind, touch, { passive: true });
    return () => {
      for (const kind of kinds) window.removeEventListener(kind, touch);
    };
  }, []);
}
