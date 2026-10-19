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
/** How near a preset place a dropped piece has to be to take it. */
export const SNAP_PX = 48;

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
  const x = col === 0 ? left - area.left : col === 2 ? area.right - left - width : left + width / 2 - (area.left + area.right) / 2;
  const y = row === 0 ? top - area.top : row === 2 ? area.bottom - top - height : top + height / 2 - (area.top + area.bottom) / 2;
  return { anchor: GRID[row][col], x: Math.round(x), y: Math.round(y) };
}

/** The preset place a piece at `box` is near enough to take, nearest first; null when it is near none. */
export function snapTo(box: Box, area: Area, within = SNAP_PX): FreeSpot | null {
  const width = box.right - box.left, height = box.bottom - box.top;
  let best: { spot: FreeSpot; d: number } | null = null;
  for (const anchor of ANCHORS) {
    const spot = presetSpot(anchor);
    const at = boxAt(spot, width, height, area);
    const d = Math.hypot(at.left - box.left, at.top - box.top);
    if (d <= within && (!best || d < best.d)) best = { spot, d };
  }
  return best?.spot ?? null;
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
