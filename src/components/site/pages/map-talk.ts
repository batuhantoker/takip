'use client';

import { useEffect, type RefObject } from 'react';
import { fromFrame, wire, type MapMark, type MarkSet, type ToFrame } from '@/lib/map/embed/messages';

const ROW = '[data-map]';
const ROUTE = '[data-map-route]';
// A pointer sweeping down a list marks where it settles, not each row it crosses.
const HOVER_MS = 90;

function markOf(row: Element): MapMark | null {
  const [lon, lat] = (row.getAttribute('data-map') ?? '').split(',').map(Number);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return { id: row.getAttribute('data-map-id') || `${lon},${lat}`, lon, lat, label: row.getAttribute('data-map-label') ?? '' };
}

/** What `el` stands for on the map: its row, or its route's rows with its own row named. */
function marksFor(el: EventTarget | null): MarkSet | null {
  if (!(el instanceof Element)) return null;
  const row = el.closest(ROW);
  const own = row && markOf(row);
  const route = el.closest(ROUTE);
  const stops = route ? [...route.querySelectorAll(ROW)].flatMap(r => markOf(r) ?? []) : [];
  if (stops.length) return { points: stops.map(p => (p.id === own?.id ? p : { ...p, label: '' })), route: true };
  return own ? { points: [own] } : null;
}

const keyOf = (m: MarkSet | null) => (m ? m.points.map(p => (p.label ? `${p.id}*` : p.id)).join('|') : '');

/** At least half of it is on screen. */
function onScreen(el: Element) {
  const r = el.getBoundingClientRect();
  return r.height > 0 && Math.min(r.bottom, innerHeight) - Math.max(r.top, 0) >= r.height / 2;
}

const plainClick = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

/**
 * Lets the page's rows talk to its live map in `frame` (lib/map/embed/messages.ts). A row carries
 * `data-map="lon,lat" data-map-id data-map-label`; hovering, focusing or tapping it marks its place, and a
 * `data-map-route` around rows makes them one day's route, kept in view together. A plain click on a link with
 * `data-map-jump="<zoom>"` flies the map there instead of leaving, while the map is on screen. A place clicked on the
 * map lights its rows (`data-map-on="pick"`) and scrolls the one nearest the reader into view. Nothing is posted
 * before the frame says it's ready.
 */
export function useMapTalk(frame: RefObject<HTMLIFrameElement | null>, mounted: boolean) {
  useEffect(() => {
    if (!mounted) return;
    let ready = false;
    let sent = '';
    let wait: ReturnType<typeof setTimeout> | undefined;
    let picked: Element[] = [];
    const target = () => frame.current?.contentWindow ?? null;

    const post = (m: ToFrame) => {
      const win = target();
      if (ready && win) win.postMessage(wire(m), location.origin);
    };
    const mark = (m: MarkSet | null) => {
      clearTimeout(wait);
      const key = keyOf(m);
      if (key === sent) return;
      sent = key;
      post({ type: 'mark', mark: m });
    };
    const unpick = () => {
      for (const r of picked) r.removeAttribute('data-map-on');
      picked = [];
    };

    const onMessage = (e: MessageEvent) => {
      const m = fromFrame(e, location.origin, target());
      if (!m) return;
      if (m.type === 'ready') {
        ready = true;
        sent = '';
        return;
      }
      unpick();
      picked = [...document.querySelectorAll(ROW)].filter(r => r.getAttribute('data-map-id') === m.id);
      for (const r of picked) r.setAttribute('data-map-on', 'pick');
      // The one nearest where the reader is: a place can be in the photos up top and in the list.
      const off = (r: Element) => { const q = r.getBoundingClientRect(); return Math.abs(q.top + q.height / 2 - innerHeight / 2); };
      const shown = picked.filter(r => r.getClientRects().length > 0).sort((a, b) => off(a) - off(b))[0];
      shown?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    };
    // The mark stays while the pointer crosses to the map to look at it.
    const onOver = (e: PointerEvent) => {
      if (e.target === frame.current) return;
      const m = marksFor(e.target);
      clearTimeout(wait);
      if (e.pointerType === 'touch') mark(m);
      else if (keyOf(m) !== sent) wait = setTimeout(() => mark(m), HOVER_MS);
    };
    const onFocusIn = (e: FocusEvent) => {
      const m = marksFor(e.target);
      if (m) mark(m);
    };
    const onFocusOut = (e: FocusEvent) => {
      if (e.relatedTarget !== frame.current && !marksFor(e.relatedTarget)) mark(null);
    };
    const onDown = (e: PointerEvent) => {
      if (!picked.some(r => r.contains(e.target as Node))) unpick();
    };
    const onClick = (e: MouseEvent) => {
      const link = e.target instanceof Element ? e.target.closest('a[data-map-jump]') : null;
      const row = link?.closest(ROW);
      const at = row && markOf(row);
      const el = frame.current;
      if (!link || !at || !ready || !el || !plainClick(e) || !onScreen(el)) return;
      e.preventDefault();
      mark(marksFor(link));
      const zoom = Number(link.getAttribute('data-map-jump'));
      post({ type: 'fly', lon: at.lon, lat: at.lat, ...(zoom >= 1.5 && zoom <= 18 ? { zoom } : {}) });
    };

    window.addEventListener('message', onMessage);
    document.addEventListener('pointerover', onOver);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('pointerdown', onDown);
    // Before the page's own handlers, so a client-side link doesn't navigate first.
    document.addEventListener('click', onClick, true);
    return () => {
      clearTimeout(wait);
      unpick();
      window.removeEventListener('message', onMessage);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('click', onClick, true);
    };
  }, [frame, mounted]);
}
