import type { CSSProperties } from 'react';
import type { Corner, FreeSpot } from './model';

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

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/**
 * Where a piece dropped at `box` goes: it hangs from the corner its middle is nearest, so a narrower window or a
 * panel opening beside the sidebar moves it with that corner rather than off the map. Kept inside the area.
 */
export function spotFromBox(box: Box, area: Area): FreeSpot {
  const left = (box.left + box.right) / 2 < (area.left + area.right) / 2;
  const top = (box.top + box.bottom) / 2 < (area.top + area.bottom) / 2;
  const corner = `${top ? 'top' : 'bottom'}-${left ? 'left' : 'right'}` as Corner;
  const roomX = area.right - area.left - (box.right - box.left);
  const roomY = area.bottom - area.top - (box.bottom - box.top);
  return {
    corner,
    x: Math.round(clamp(left ? box.left - area.left : area.right - box.right, 0, roomX)),
    y: Math.round(clamp(top ? box.top - area.top : area.bottom - box.bottom, 0, roomY)),
  };
}

/** The same edges as the corner slots: left of the sidebar's panel (--shell-left), above the status bar or a timeline. */
export function spotStyle({ corner, x, y }: FreeSpot): CSSProperties {
  const horizontal = corner.endsWith('left') ? { left: `calc(var(--shell-left, 0px) + ${x}px)` } : { right: x };
  const vertical = corner.startsWith('top') ? { top: y } : { bottom: `calc(var(--shell-bottom, var(--shell-foot, 28px)) + ${y}px)` };
  return { ...horizontal, ...vertical };
}
