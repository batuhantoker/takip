'use client';

import { useEffect } from 'react';
import { windowStore } from '@/components/map/windows';
import { KINDS } from '@/components/map/windows/kinds';
import { reportMapMinute } from '@/components/site/page-view';
import { shownPage } from '@/lib/platform/visitor';

const MINUTE = 60_000;
// A cursor only crossing the map on its way elsewhere is gone sooner.
const HOVER_MS = 2_000;
const WATCH_CHECK_MS = 15_000;

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

/** Some of this frame is on the host page's screen. */
function frameOnScreen() {
  try {
    const r = window.frameElement?.getBoundingClientRect();
    return !!r && r.bottom > 0 && r.right > 0 && r.top < window.parent.innerHeight && r.left < window.parent.innerWidth;
  } catch {
    return false;
  }
}

const watching = () => windowStore.get().list.some(w => KINDS[w.kind].video && !w.folded);

/**
 * On our own pages, books a minute for each minute the reader uses this small map: the first use books one, and the next
 * books another once a minute has passed. Moving, zooming, clicking and keys count at once, and a mouse moving over the
 * map once it has stayed a moment. While a camera or channel plays in it, each minute the frame is on screen in a
 * visible tab counts too. A finger counts when it lifts: one the browser took for scrolling the page past the map is
 * cancelled first.
 */
export function usePageMapTime() {
  useEffect(() => {
    let booked = -Infinity;
    let hoverFrom: number | null = null;
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
      if (e.type === 'pointerout') {
        if (!e.relatedTarget) hoverFrom = null;
      } else if (e.type === 'pointerdown' || (e.type === 'pointermove' && e.buttons)) book();
      else if (e.type === 'pointermove' && e.pointerType === 'mouse') {
        hoverFrom ??= e.timeStamp;
        if (e.timeStamp - hoverFrom >= HOVER_MS) book();
      }
    };
    const kinds = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerout', 'wheel', 'keydown'] as const;
    for (const kind of kinds) window.addEventListener(kind, touch, { passive: true });
    const watch = setInterval(() => {
      if (document.visibilityState === 'visible' && watching() && frameOnScreen()) book();
    }, WATCH_CHECK_MS);
    return () => {
      for (const kind of kinds) window.removeEventListener(kind, touch);
      clearInterval(watch);
    };
  }, []);
}
