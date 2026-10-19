'use client';

import { useEffect } from 'react';
import { noteArrival, outsideReferrer, visitorId } from '@/lib/platform/visitor';

/**
 * Counts one view of a public page (apps/api analytics/page-reads.ts): the page's English path, its language, the
 * site that sent the reader and the browser's random visitor id. It spends none of the reader's map time.
 */
export function PageView({ path, locale }: { path: string; locale: string }) {
  useEffect(() => {
    noteArrival();
    const id = visitorId();
    if (!id) return;
    const body = JSON.stringify({ visitor: { id, referrer: outsideReferrer() }, path, locale });
    if (!navigator.sendBeacon?.('/api/v1/page-view', new Blob([body], { type: 'application/json' }))) {
      fetch('/api/v1/page-view', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => {});
    }
  }, [path, locale]);
  return null;
}
