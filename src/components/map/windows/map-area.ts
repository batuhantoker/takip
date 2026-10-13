'use client';

import { useSyncExternalStore } from 'react';
import { GAP, type Area } from '@/components/map/windows/lib/geometry';

/** Where windows may go, and where the docked column runs. */
export interface MapArea extends Area {
  colTop: number;
  colRight: number;
  /** Above the control cluster in the bottom-right corner. */
  colBottom: number;
}

const EDGE = 12;
const SERVER: MapArea = { left: 0, top: 0, right: 1280, bottom: 772, colTop: EDGE, colRight: 1268, colBottom: 560 };

let area: MapArea = SERVER;
const listeners = new Set<() => void>();
let stop: (() => void) | null = null;

function read(): MapArea {
  const main = document.querySelector('main');
  // --shell-left lives on <main>, --shell-bottom on <html>; the status bar is 28 px without a timeline.
  const left = parseFloat(main ? getComputedStyle(main).getPropertyValue('--shell-left') : '') || 0;
  const shellBottom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--shell-bottom')) || 28;
  const W = window.innerWidth, H = window.innerHeight;
  const bottom = H - shellBottom;
  let cluster = bottom;
  for (const el of document.querySelectorAll<HTMLElement>('[data-hud]')) {
    const r = el.getBoundingClientRect();
    if (r.height && r.right > W - 60 && r.top > H / 2) cluster = Math.min(cluster, r.top);
  }
  return { left, top: 0, right: W, bottom, colTop: EDGE, colRight: W - EDGE, colBottom: cluster - GAP };
}

const same = (a: MapArea, b: MapArea) => (Object.keys(a) as (keyof MapArea)[]).every(k => a[k] === b[k]);

function refresh() {
  const next = read();
  if (same(next, area)) return;
  area = next;
  listeners.forEach(l => l());
}

function start() {
  area = read();
  const sizes = new ResizeObserver(refresh);
  const watchHud = () => document.querySelectorAll('[data-hud]').forEach(el => sizes.observe(el));
  watchHud();
  const styles = new MutationObserver(() => { watchHud(); refresh(); });
  const main = document.querySelector('main');
  if (main) styles.observe(main, { attributes: true, attributeFilter: ['style'] });
  styles.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
  window.addEventListener('resize', refresh);
  return () => { sizes.disconnect(); styles.disconnect(); window.removeEventListener('resize', refresh); };
}

function subscribe(l: () => void) {
  listeners.add(l);
  if (!stop) stop = start();
  return () => {
    listeners.delete(l);
    if (!listeners.size && stop) { stop(); stop = null; }
  };
}

export const getArea = () => (typeof window === 'undefined' ? SERVER : stop ? area : read());

export function useMapArea(): MapArea {
  return useSyncExternalStore(subscribe, () => area, () => SERVER);
}
