'use client';

import { useSyncExternalStore } from 'react';
import { clampRect, fits, GAP, stackColumn, type StackSlot } from '@/components/map/windows/lib/geometry';
import { KINDS, MAX_PLAYING, openWidth, type WindowKind } from './kinds';
import { getArea, type MapArea } from './map-area';
import { clearPlaces, loadPlaces, savePlace } from '@/components/map/windows/lib/persist';

/**
 * Every window over the map: where it is and how it sits. Whether a window exists is up to
 * whoever renders it; a window registers while mounted and its owner's onClose closes it.
 */
export interface WinState {
  id: string;
  kind: WindowKind;
  /** Open order: the docked column puts the highest at the top. */
  seq: number;
  /** Stacking order: the highest is in front. */
  z: number;
  docked: boolean;
  x: number;
  y: number;
  w: number;
  /** A height the person chose; null follows the content. */
  h: number | null;
  /** Folded to its header by the person. */
  folded: boolean;
  /** The size to go back to after the large size, while large. */
  big: { w: number; h: number | null } | null;
  /** The window this one was snapped to, which it moves with. */
  anchor: string | null;
  closable: boolean;
  /** Measured: the height it wants, and its header's. */
  want: number;
  head: number;
}

export interface WindowsSnapshot {
  list: WinState[];
  /** Bumps on every open, so the Escape claim can move to the top of the kit's stack. */
  opened: number;
  /** A remembered place no longer fit the screen. */
  offerReset: boolean;
}

let wins: Record<string, WinState> = {};
let snap: WindowsSnapshot = { list: [], opened: 0, offerReset: false };
let seq = 0, z = 0;
const listeners = new Set<() => void>();
const closers = new Map<string, () => void>();

function emit(patch: Partial<WindowsSnapshot> = {}) {
  snap = { ...snap, ...patch, list: Object.values(wins).sort((a, b) => a.seq - b.seq) };
  listeners.forEach(l => l());
}

function update(id: string, patch: Partial<WinState>) {
  const w = wins[id];
  if (!w) return;
  wins = { ...wins, [id]: { ...w, ...patch } };
}

const membersOf = (id: string) => Object.values(wins).filter(w => w.anchor === id);

function release(id: string) {
  for (const m of membersOf(id)) update(m.id, { anchor: null });
}

const frontOf = (list: WinState[]) => list.filter(w => w.closable).sort((a, b) => b.z - a.z)[0];

export const windowStore = {
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  get: () => snap,
  find: (id: string) => wins[id] as WinState | undefined,

  register(id: string, kind: WindowKind, closable: boolean, onClose: () => void) {
    closers.set(id, onClose);
    if (wins[id]) { update(id, { closable }); return; }
    const mem = loadPlaces()[kind];
    const a = getArea();
    const w = openWidth(kind, a, mem?.w);
    let docked = true, x = 0, y = 0, offerReset = snap.offerReset;
    if (mem && mem.docked === false && mem.x != null && mem.y != null) {
      let px = mem.x, py = mem.y;
      // A second window of the same kind opens a step down and right of the first.
      while (Object.values(wins).some(o => !o.docked && Math.abs(o.x - px) < 4 && Math.abs(o.y - py) < 4)) { px += 24; py += 24; }
      if (fits({ x: px, y: py, w, h: Math.min(mem.h ?? 200, a.bottom - a.top) }, a)) { docked = false; x = px; y = py; }
      else offerReset = true;
    }
    wins = { ...wins, [id]: { id, kind, seq: ++seq, z: ++z, docked, x, y, w, h: mem?.h ?? null, folded: false, big: null, anchor: null, closable, want: 0, head: 44 } };
    emit({ opened: snap.opened + 1, offerReset });
  },

  unregister(id: string) {
    if (!wins[id]) return;
    release(id);
    const { [id]: _gone, ...rest } = wins; // eslint-disable-line @typescript-eslint/no-unused-vars
    wins = rest;
    closers.delete(id);
    emit();
  },

  focus(id: string) {
    if (!wins[id] || wins[id].z === z) return;
    update(id, { z: ++z });
    emit();
  },

  measure(id: string, want: number, head: number) {
    const w = wins[id];
    if (!w || (Math.abs(w.want - want) < 1 && Math.abs(w.head - head) < 1)) return;
    update(id, { want, head });
    emit();
  },

  /** Frees a window at a spot; the windows snapped to it come along to theirs. */
  moveGroup(id: string, x: number, y: number, members: Array<{ id: string; x: number; y: number }>, attach: string | null) {
    const w = wins[id];
    if (!w) return;
    if (w.docked || w.anchor) release(id);
    update(id, { docked: false, x, y, anchor: null });
    for (const m of members) update(m.id, { x: m.x, y: m.y });
    if (attach && wins[attach] && attach !== id) {
      const anchor = wins[attach].anchor ?? attach;
      update(id, { anchor });
      for (const m of membersOf(id)) update(m.id, { anchor });
    }
    savePlace(w.kind, { docked: false, x, y });
    emit();
  },

  dock(id: string) {
    const w = wins[id];
    if (!w) return;
    release(id);
    update(id, { docked: true, anchor: null, seq: ++seq });
    savePlace(w.kind, { docked: true });
    emit();
  },

  /** A finished resize; a docked window keeps its place in the column. */
  resize(id: string, r: { x: number; y: number; w: number; h: number | null }) {
    const w = wins[id];
    if (!w) return;
    update(id, w.docked ? { w: r.w, h: r.h, big: null } : { x: r.x, y: r.y, w: r.w, h: r.h, big: null });
    savePlace(w.kind, { w: r.w, h: r.h });
    emit();
  },

  fold(id: string, folded: boolean) {
    if (!wins[id]) return;
    update(id, { folded });
    emit();
  },

  /** A folded window clicked open: it comes to the top of the column, and the others make room. */
  expand(id: string) {
    const w = wins[id];
    if (!w) return;
    update(id, { folded: false, ...(w.docked ? { seq: ++seq } : {}), z: ++z });
    emit();
  },

  toggleBig(id: string) {
    const w = wins[id];
    if (!w) return;
    if (w.big) update(id, { w: w.big.w, h: w.big.h, big: null });
    else {
      const a = getArea();
      const width = Math.min(KINDS[w.kind].big, a.right - a.left - 2 * GAP);
      update(id, { big: { w: w.w, h: w.h }, w: width, h: null, folded: false });
      if (!w.docked) {
        const tall = KINDS[w.kind].video ? w.want - (w.w * 9) / 16 + (width * 9) / 16 : w.want;
        const { x, y } = clampRect({ x: w.x, y: w.y, w: width, h: Math.min(tall, a.bottom - a.top) }, a);
        update(id, { x, y });
      }
    }
    emit();
  },

  /** After the screen or the sidebar changes, free windows come back inside the map. */
  clampAll(a: MapArea) {
    let moved = false;
    for (const w of Object.values(wins)) {
      if (w.docked) continue;
      const r = clampRect({ x: w.x, y: w.y, w: w.w, h: Math.min(w.h ?? w.want, a.bottom - a.top) }, a);
      if (r.x !== w.x || r.y !== w.y) { update(w.id, { x: r.x, y: r.y }); moved = true; }
    }
    if (moved) emit();
  },

  closeFront() {
    const f = frontOf(snap.list);
    if (f) closers.get(f.id)?.();
  },

  closeAll() {
    for (const w of snap.list) if (w.closable) closers.get(w.id)?.();
  },

  /** Forgets every remembered place and puts the windows back in the column. */
  resetPlaces() {
    clearPlaces();
    const a = getArea();
    for (const w of Object.values(wins)) update(w.id, { docked: true, anchor: null, h: null, big: null, w: openWidth(w.kind, a) });
    emit({ offerReset: false });
  },
};

export function useWindows(): WindowsSnapshot {
  return useSyncExternalStore(windowStore.subscribe, windowStore.get, windowStore.get);
}

/** Close all, or a reset to offer: a row of its own at the top of the column. */
export const showControls = (s: Pick<WindowsSnapshot, 'list' | 'offerReset'>) => s.offerReset || s.list.filter(w => w.closable).length >= 2;
const CONTROLS_ROW = 28 + GAP;

/** The docked column, newest at the top, each window folded or open to fit. */
export function columnSlots(s: Pick<WindowsSnapshot, 'list' | 'offerReset'>, a: MapArea): StackSlot[] {
  const docked = s.list.filter(w => w.docked).sort((p, q) => q.seq - p.seq);
  const top = a.colTop + (showControls(s) ? CONTROLS_ROW : 0);
  return stackColumn(docked.map(w => ({ id: w.id, want: w.h ?? w.want, head: w.head, folded: w.folded })), top, a.colBottom);
}

/** The video windows that may play: the ones nearest the front. */
export function playingIds(list: WinState[]): Set<string> {
  return new Set(list.filter(w => KINDS[w.kind].video).sort((p, q) => q.z - p.z).slice(0, MAX_PLAYING).map(w => w.id));
}

export const frontWindow = (list: WinState[]) => list.slice().sort((a, b) => b.z - a.z)[0]?.id ?? null;
