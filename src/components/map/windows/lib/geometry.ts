/** Pure layout for windows on the map: clamping, the docked column, snapping and resizing. */

export type Rect = { x: number; y: number; w: number; h: number };
/** The part of the screen windows may use: right of the sidebar, above the status bar. */
export type Area = { left: number; top: number; right: number; bottom: number };
export type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export type Guide = { x1: number; y1: number; x2: number; y2: number };

export const GAP = 8;
/** Short of this, a window that does not fit folds instead of scrolling. */
const MIN_OPEN = 220;
/** How close an edge has to come before it snaps. */
export const SNAP = 10;

export function clampRect(r: Rect, a: Area): Rect {
  const x = Math.max(a.left, Math.min(r.x, a.right - r.w));
  const y = Math.max(a.top, Math.min(r.y, a.bottom - r.h));
  return { ...r, x, y };
}

export const fits = (r: Rect, a: Area) => r.x >= a.left && r.y >= a.top && r.x + r.w <= a.right && r.y + r.h <= a.bottom;

export interface StackItem {
  id: string;
  /** Height it wants, or what the person sized it to. */
  want: number;
  /** Height of its header alone. */
  head: number;
  /** Collapsed by the person, not by the lack of room. */
  folded: boolean;
}

export interface StackSlot { id: string; y: number; h: number; collapsed: boolean }

/**
 * The docked column, newest first from the top. Each window opens fully if it fits with
 * room left for the headers of the older ones, opens scrolling if a fair amount of room is
 * left, and otherwise folds to its header. The newest always opens.
 */
export function stackColumn(items: StackItem[], top: number, bottom: number): StackSlot[] {
  const out: StackSlot[] = [];
  let y = top;
  items.forEach((it, i) => {
    const below = items.slice(i + 1).reduce((s, o) => s + o.head + GAP, 0);
    const room = bottom - y - below;
    let h: number;
    let collapsed = false;
    if (!it.folded && it.want <= room) h = it.want;
    else if (!it.folded && (i === 0 || room >= MIN_OPEN)) h = Math.max(it.head, room);
    else { h = it.head; collapsed = true; }
    out.push({ id: it.id, y, h, collapsed });
    y += h + GAP;
  });
  return out;
}

export interface Snapped { x: number; y: number; guides: Guide[]; attach: string | null }

const near = (a: number, b: number) => Math.abs(a - b) <= SNAP;
const overlap = (a1: number, a2: number, b1: number, b2: number, pad = 0) => a1 < b2 + pad && a2 > b1 - pad;

/**
 * Pulls a moving window flush against a neighbour (with the gap) or the edge of the area,
 * and lines it up with a neighbour's top or left. `attach` is the neighbour it now touches.
 */
export function snapRect(m: Rect, others: Array<Rect & { id: string }>, a: Area): Snapped {
  type Hit = { d: number; v: number; guide: Guide; attach: string | null };
  let bx: Hit | null = null;
  let by: Hit | null = null;
  const tryX = (edge: number, to: number, v: number, guide: Guide, attach: string | null) => {
    if (near(edge, to) && (!bx || Math.abs(edge - to) < bx.d)) bx = { d: Math.abs(edge - to), v, guide, attach };
  };
  const tryY = (edge: number, to: number, v: number, guide: Guide, attach: string | null) => {
    if (near(edge, to) && (!by || Math.abs(edge - to) < by.d)) by = { d: Math.abs(edge - to), v, guide, attach };
  };
  const right = m.x + m.w, bottom = m.y + m.h;

  for (const o of others) {
    const oR = o.x + o.w, oB = o.y + o.h;
    const top = Math.min(m.y, o.y), low = Math.max(bottom, oB);
    const left = Math.min(m.x, o.x), far = Math.max(right, oR);
    if (overlap(m.y, bottom, o.y, oB, SNAP)) {
      // Side by side.
      tryX(m.x, oR + GAP, oR + GAP, { x1: oR + GAP / 2, y1: top, x2: oR + GAP / 2, y2: low }, o.id);
      tryX(right, o.x - GAP, o.x - GAP - m.w, { x1: o.x - GAP / 2, y1: top, x2: o.x - GAP / 2, y2: low }, o.id);
      tryY(m.y, o.y, o.y, { x1: left, y1: o.y, x2: far, y2: o.y }, null);
    }
    if (overlap(m.x, right, o.x, oR, SNAP)) {
      // One above the other.
      tryY(m.y, oB + GAP, oB + GAP, { x1: left, y1: oB + GAP / 2, x2: far, y2: oB + GAP / 2 }, o.id);
      tryY(bottom, o.y - GAP, o.y - GAP - m.h, { x1: left, y1: o.y - GAP / 2, x2: far, y2: o.y - GAP / 2 }, o.id);
      tryX(m.x, o.x, o.x, { x1: o.x, y1: top, x2: o.x, y2: low }, null);
    }
  }
  tryX(m.x, a.left + GAP, a.left + GAP, { x1: a.left + GAP, y1: a.top, x2: a.left + GAP, y2: a.bottom }, null);
  tryX(right, a.right - GAP, a.right - GAP - m.w, { x1: a.right - GAP, y1: a.top, x2: a.right - GAP, y2: a.bottom }, null);
  tryY(m.y, a.top + GAP, a.top + GAP, { x1: a.left, y1: a.top + GAP, x2: a.right, y2: a.top + GAP }, null);
  tryY(bottom, a.bottom - GAP, a.bottom - GAP - m.h, { x1: a.left, y1: a.bottom - GAP, x2: a.right, y2: a.bottom - GAP }, null);

  const sx = bx as Hit | null, sy = by as Hit | null;
  return {
    x: sx ? sx.v : m.x,
    y: sy ? sy.v : m.y,
    guides: [sx?.guide, sy?.guide].filter((g): g is Guide => !!g),
    attach: sx?.attach ?? sy?.attach ?? null,
  };
}

export interface Limits { minW: number; minH: number; maxW: number; maxH: number }

/**
 * A resize from one edge or corner. With `video` set to the height of the window's chrome
 * the picture keeps 16:9: the width leads and the height follows.
 */
export function resizeRect(start: Rect, edge: Edge, dx: number, dy: number, lim: Limits, video?: number): Rect {
  const clampW = (w: number) => Math.max(lim.minW, Math.min(lim.maxW, w));
  const clampH = (h: number) => Math.max(lim.minH, Math.min(lim.maxH, h));
  const west = edge.includes('w'), north = edge.startsWith('n');
  const horiz = edge.includes('e') || west, vert = north || edge.startsWith('s');
  let w = start.w, h = start.h;
  if (video !== undefined) {
    const fromW = horiz ? start.w + (west ? -dx : dx) : start.w;
    const fromH = vert ? (start.h + (north ? -dy : dy) - video) * (16 / 9) : start.w;
    // A corner follows whichever way the pointer pulled further.
    w = clampW(horiz && vert ? (Math.abs(fromW - start.w) >= Math.abs(fromH - start.w) ? fromW : fromH) : horiz ? fromW : fromH);
    h = video + Math.round((w * 9) / 16);
  } else {
    if (horiz) w = clampW(start.w + (west ? -dx : dx));
    if (vert) h = clampH(start.h + (north ? -dy : dy));
  }
  return { x: west ? start.x + start.w - w : start.x, y: north ? start.y + start.h - h : start.y, w, h };
}
