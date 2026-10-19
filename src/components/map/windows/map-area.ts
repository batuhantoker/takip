'use client';

import { useSyncExternalStore } from 'react';
import { GAP, type Area } from '@/components/map/windows/lib/geometry';

/** Where windows may go, and where the docked column runs. */
export interface MapArea extends Area {
  colTop: number;
  colRight: number;
  /** Above whatever the person keeps in the bottom-right corner. */
  colBottom: number;
}

const EDGE = 12;
/** The docked column's reach in from the right edge: a 340 px card and its margins. */
const COLUMN = 352;
const SERVER: MapArea = { left: 0, top: 0, right: 1280, bottom: 772, colTop: EDGE, colRight: 1268, colBottom: 560 };

let area: MapArea = SERVER;
const listeners = new Set<() => void>();
let stop: (() => void) | null = null;

// An explicit 0 (the status bar hidden) is a real value, not a missing one.
function px(style: CSSStyleDeclaration, name: string): number | null {
  const v = parseFloat(style.getPropertyValue(name));
  return Number.isFinite(v) ? v : null;
}

/** A right-hand corner of the map (shell/layout/corner-slots.tsx), when anything in it shows. */
function corner(name: 'top-right' | 'bottom-right'): DOMRect | null {
  const r = document.querySelector(`[data-corner="${name}"]`)?.getBoundingClientRect();
  return r?.height ? r : null;
}

function read(): MapArea {
  const main = document.querySelector('main');
  const root = getComputedStyle(document.documentElement);
  // --shell-left lives on <main>; on <html>, --shell-bottom while a timeline shows, else --shell-foot (the status bar, or 0).
  const left = (main && px(getComputedStyle(main), '--shell-left')) ?? 0;
  const shellBottom = px(root, '--shell-bottom') ?? px(root, '--shell-foot') ?? 28;
  const W = window.innerWidth, H = window.innerHeight;
  const bottom = H - shellBottom;
  const top = corner('top-right'), low = corner('bottom-right');
  let colTop = top ? Math.max(EDGE, top.bottom + GAP) : EDGE;
  let colBottom = (low ? Math.min(bottom, low.top) : bottom) - GAP;
  // A piece placed by hand across the column's path: above the middle the column starts under it, below it ends over it.
  for (const el of document.querySelectorAll<HTMLElement>('[data-free]')) {
    const r = el.getBoundingClientRect();
    if (!r.height || r.right < W - COLUMN) continue;
    if (r.top + r.bottom < H) colTop = Math.max(colTop, r.bottom + GAP);
    else colBottom = Math.min(colBottom, r.top - GAP);
  }
  return { left, top: 0, right: W, bottom, colTop, colRight: W - EDGE, colBottom };
}

const same = (a: MapArea, b: MapArea) => (Object.keys(a) as (keyof MapArea)[]).every(k => a[k] === b[k]);

function refresh() {
  const next = read();
  if (same(next, area)) return;
  area = next;
  listeners.forEach(l => l());
}

let rewatch: (() => void) | null = null;

function start() {
  area = read();
  const sizes = new ResizeObserver(refresh);
  const watchHud = () => document.querySelectorAll('[data-hud]').forEach(el => sizes.observe(el));
  rewatch = watchHud;
  watchHud();
  const styles = new MutationObserver(() => { watchHud(); refresh(); });
  const main = document.querySelector('main');
  if (main) styles.observe(main, { attributes: true, attributeFilter: ['style'] });
  styles.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
  window.addEventListener('resize', refresh);
  return () => { rewatch = null; sizes.disconnect(); styles.disconnect(); window.removeEventListener('resize', refresh); };
}

/** After the layout moves a piece: a move changes no size, so nothing above would notice it. */
export function refreshMapArea() {
  if (!stop) return;
  rewatch?.();
  refresh();
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
