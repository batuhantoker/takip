import type { CSSProperties } from 'react';
import { ANCHORS, axes, type Anchor, type FreeSpot } from './model';

/** The map area a piece can sit in, in viewport px: right of the sidebar and any panel, above the status bar. */
export interface Area {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** An edge keeps the corner slots' 12 px; a middle sits right on it. */
const MARGIN = 12;
/** How near a preset place, or the side of another piece, a dropped piece has to be to take it. */
export const SNAP_PX = 48;
/** Between pieces set side by side, as in a corner's stack. */
export const GAP_PX = 8;
/** Pieces this close in size are only lined up on their middles: a 38 px pill beside a 40 px field. */
const ALIGN_PX = 6;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
const GRID: Anchor[][] = [['top-left', 'top', 'top-right'], ['left', 'center', 'right'], ['bottom-left', 'bottom', 'bottom-right']];
const third = (v: number, lo: number, hi: number) => (v < lo + (hi - lo) / 3 ? 0 : v > hi - (hi - lo) / 3 ? 2 : 1);

/** The nine preset places: each corner and the middle of each edge, 12 px in, and the middle of the map. */
export function presetSpot(anchor: Anchor): FreeSpot {
  const { h, v } = axes(anchor);
  return { anchor, x: h === 'middle' ? 0 : MARGIN, y: v === 'middle' ? 0 : MARGIN };
}

/** Where a piece of this size sits at a spot. */
export function boxAt({ anchor, x, y }: FreeSpot, width: number, height: number, area: Area): Box {
  const { h, v } = axes(anchor);
  const left = h === 'left' ? area.left + x : h === 'right' ? area.right - x - width : (area.left + area.right) / 2 + x - width / 2;
  const top = v === 'top' ? area.top + y : v === 'bottom' ? area.bottom - y - height : (area.top + area.bottom) / 2 + y - height / 2;
  return { left, top, right: left + width, bottom: top + height };
}

/** A spot for a piece at `box`, measured from `anchor`'s edges or middles. */
export function spotAt(box: Box, anchor: Anchor, area: Area): FreeSpot {
  const { h, v } = axes(anchor);
  const x = h === 'left' ? box.left - area.left : h === 'right' ? area.right - box.right : (box.left + box.right) / 2 - (area.left + area.right) / 2;
  const y = v === 'top' ? box.top - area.top : v === 'bottom' ? area.bottom - box.bottom : (box.top + box.bottom) / 2 - (area.top + area.bottom) / 2;
  return { anchor, x: Math.round(x), y: Math.round(y) };
}

/**
 * Where a piece dropped at `box` goes: it hangs from the third of the map its middle is in (a corner, an edge's
 * middle or the map's), so a narrower window or a panel opening beside the sidebar carries it along. Kept inside the area.
 */
export function spotFromBox(box: Box, area: Area): FreeSpot {
  const width = box.right - box.left, height = box.bottom - box.top;
  const col = third((box.left + box.right) / 2, area.left, area.right);
  const row = third((box.top + box.bottom) / 2, area.top, area.bottom);
  const left = clamp(box.left, area.left, area.right - width);
  const top = clamp(box.top, area.top, area.bottom - height);
  return spotAt({ left, top, right: left + width, bottom: top + height }, GRID[row][col], area);
}

/** Another piece on the map, and what it hangs from (its corner, or its own spot's anchor). */
export interface Neighbour {
  box: Box;
  anchor: Anchor;
}

/** Where a dragged piece would land, and whether that is one of the nine presets. */
export interface Snap {
  spot: FreeSpot;
  box: Box;
  preset: Anchor | null;
}

const at = (left: number, top: number, width: number, height: number): Box => ({ left, top, right: left + width, bottom: top + height });
const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const inside = (b: Box, area: Area) => b.left >= area.left && b.top >= area.top && b.right <= area.right && b.bottom <= area.bottom;

/** Lined up on the middle, and on both ends too when the sizes differ enough for that to show. */
const lineUps = (start: number, end: number, size: number) => {
  const middle = (start + end - size) / 2;
  return Math.abs(end - start - size) < 2 * ALIGN_PX ? [middle] : [middle, start, end - size];
};

/** Beside a piece, as the corner stacks set them: to either side lined up with its top, bottom or middle, or above or below lined up with its sides or middle. */
function beside(n: Box, width: number, height: number): Box[] {
  const rows = lineUps(n.top, n.bottom, height);
  const cols = lineUps(n.left, n.right, width);
  return [
    ...rows.flatMap(top => [at(n.right + GAP_PX, top, width, height), at(n.left - GAP_PX - width, top, width, height)]),
    ...cols.flatMap(left => [at(left, n.bottom + GAP_PX, width, height), at(left, n.top - GAP_PX - height, width, height)]),
  ];
}

/**
 * Where a piece at `box` snaps to, nearest first: one of the nine presets, or beside another piece (hung from that
 * piece's anchor, so the two move together). A place that would cover another piece or leave the map is passed over.
 * Null when it is near none.
 */
export function snapTo(box: Box, area: Area, neighbours: Neighbour[] = [], within = SNAP_PX): Snap | null {
  const width = box.right - box.left, height = box.bottom - box.top;
  const candidates: Snap[] = [
    ...ANCHORS.map(anchor => {
      const spot = presetSpot(anchor);
      return { spot, box: boxAt(spot, width, height, area), preset: anchor };
    }),
    ...neighbours.flatMap(n => beside(n.box, width, height).map(b => ({ spot: spotAt(b, n.anchor, area), box: b, preset: null }))),
  ];
  let best: { snap: Snap; d: number } | null = null;
  for (const c of candidates) {
    const d = Math.hypot(c.box.left - box.left, c.box.top - box.top);
    if (d > within || (best && d >= best.d) || !inside(c.box, area) || neighbours.some(n => overlaps(c.box, n.box))) continue;
    best = { snap: c, d };
  }
  return best?.snap ?? null;
}

// The same edges as the corner slots: in from the sidebar's panel (--shell-left), up from the status bar or a timeline.
const LEFT_EDGE = 'var(--shell-left, 0px)';
const FOOT = 'var(--shell-bottom, var(--shell-foot, 28px))';

/** A spot as CSS on a piece's wrapper, a child of the full-screen <main>; a middle centres the piece on it. */
export function spotStyle({ anchor, x, y }: FreeSpot): CSSProperties {
  const { h, v } = axes(anchor);
  const horizontal = h === 'left' ? { left: `calc(${LEFT_EDGE} + ${x}px)` }
    : h === 'right' ? { right: x }
    : { left: `calc(${LEFT_EDGE} + (100% - ${LEFT_EDGE}) / 2 + ${x}px)` };
  const vertical = v === 'top' ? { top: y }
    : v === 'bottom' ? { bottom: `calc(${FOOT} + ${y}px)` }
    : { top: `calc((100% - ${FOOT}) / 2 + ${y}px)` };
  const centred = h === 'middle' || v === 'middle';
  return { ...horizontal, ...vertical, ...(centred && { transform: `translate(${h === 'middle' ? '-50%' : '0'}, ${v === 'middle' ? '-50%' : '0'})` }) };
}
