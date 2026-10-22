'use client';

import { useEffect } from 'react';
import { notePage, noteArrival, outsideReferrer, outsideReferrerPath, visitorId } from '@/lib/platform/visitor';

/**
 * Reports one view (apps/api analytics/page-reads.ts): the page's English path ('/' for the map), its language, the page
 * this tab showed before, the site (and page, if shared) that sent the reader, the address's campaign tags and the
 * browser's random visitor id.
 */
export function reportView(path: string, locale: string) {
  const id = visitorId();
  if (!id) return;
  const from = notePage(path);
  send({ visitor: { id, referrer: outsideReferrer(), landing: location.pathname + location.search }, path, locale, from, referrerPath: outsideReferrerPath() });
}

/** Books a minute of the reader moving, zooming or clicking `path`'s small map. Like a view, it spends none of their map time. */
export function reportMapMinute(path: string) {
  const id = visitorId();
  if (id) send({ visitor: { id }, path, use: 'map' });
}

function send(report: object) {
  const body = JSON.stringify(report);
  if (!navigator.sendBeacon?.('/api/v1/page-view', new Blob([body], { type: 'application/json' }))) {
    fetch('/api/v1/page-view', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => {});
  }
}

/** Counts one view of a public page as it opens. It spends none of the reader's map time. */
export function PageView({ path, locale }: { path: string; locale: string }) {
  useEffect(() => {
    noteArrival();
    reportView(path, locale);
  }, [path, locale]);
  return null;
}
