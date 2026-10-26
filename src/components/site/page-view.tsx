'use client';

import { useEffect } from 'react';
import { engagedClock } from '@/lib/platform/engaged-clock';
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
  // Puppeteer, Playwright and headless Chrome say so here, whatever user agent they give.
  if (navigator.webdriver) return;
  const body = JSON.stringify(report);
  if (!navigator.sendBeacon?.('/api/v1/page-view', new Blob([body], { type: 'application/json' }))) {
    fetch('/api/v1/page-view', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => {});
  }
}

const INPUTS = ['scroll', 'wheel', 'pointerdown', 'pointermove', 'keydown', 'touchstart'] as const;
const LISTEN = { capture: true, passive: true };

/**
 * Sends `path`'s engaged time so far (engaged-clock.ts) each time the tab hides or closes, and once more from the
 * returned stop, when the reader moves on to another page here. The api keeps the highest total it is sent.
 */
function trackEngagedTime(path: string) {
  const visible = () => document.visibilityState === 'visible';
  const clock = engagedClock(performance.now(), visible());
  let sent = -1;
  const report = () => {
    const ms = Math.round(clock.total(performance.now()));
    const id = visitorId();
    if (ms === sent || !id) return;
    sent = ms;
    send({ visitor: { id }, path, use: 'time', ms });
  };
  const input = () => clock.input(performance.now());
  // Back from the browser's page cache too, which may not say the page became visible.
  const shown = () => {
    clock.shown(performance.now(), visible());
    if (!visible()) report();
  };
  for (const name of INPUTS) window.addEventListener(name, input, LISTEN);
  document.addEventListener('visibilitychange', shown);
  window.addEventListener('pageshow', shown);
  window.addEventListener('pagehide', report);
  return () => {
    for (const name of INPUTS) window.removeEventListener(name, input, LISTEN);
    document.removeEventListener('visibilitychange', shown);
    window.removeEventListener('pageshow', shown);
    window.removeEventListener('pagehide', report);
    report();
  };
}

/** Counts one view of a public page as it opens, and how long it is read. It spends none of the reader's map time. */
export function PageView({ path, locale }: { path: string; locale: string }) {
  useEffect(() => {
    noteArrival();
    reportView(path, locale);
    return trackEngagedTime(path);
  }, [path, locale]);
  // Back from another page, the browser may show this one as it left it, without its effects: the tab still names
  // the other page, and this page's small map would book its minutes there.
  useEffect(() => {
    const restored = (e: PageTransitionEvent) => {
      if (e.persisted) notePage(path);
    };
    window.addEventListener('pageshow', restored);
    return () => window.removeEventListener('pageshow', restored);
  }, [path]);
  return null;
}
