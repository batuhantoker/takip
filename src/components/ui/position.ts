export type Side = 'top' | 'bottom' | 'left' | 'right';
export type Align = 'start' | 'center' | 'end';

/** The trigger under a wrapper: the first child that draws a box, past any display: contents wrappers (such as Tooltip's). */
export function anchorIn(wrap: Element | null | undefined): HTMLElement | null {
  let el = wrap?.firstElementChild ?? null;
  while (el && getComputedStyle(el).display === 'contents') el = el.firstElementChild;
  return el as HTMLElement | null;
}

const OPPOSITE: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

/** Where a floating box of `size` goes beside `anchor`: flipped when it would not fit, then kept on screen. */
export function place(anchor: DOMRect, size: { width: number; height: number }, side: Side, align: Align, gap = 8, margin = 8) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const room: Record<Side, number> = {
    top: anchor.top - gap - margin,
    bottom: vh - anchor.bottom - gap - margin,
    left: anchor.left - gap - margin,
    right: vw - anchor.right - gap - margin,
  };
  const need = side === 'top' || side === 'bottom' ? size.height : size.width;
  const flip = OPPOSITE[side];
  const final = room[side] < need && room[flip] > room[side] ? flip : side;

  let x: number;
  let y: number;
  if (final === 'top' || final === 'bottom') {
    y = final === 'top' ? anchor.top - gap - size.height : anchor.bottom + gap;
    x = align === 'start' ? anchor.left : align === 'end' ? anchor.right - size.width : anchor.left + (anchor.width - size.width) / 2;
  } else {
    x = final === 'left' ? anchor.left - gap - size.width : anchor.right + gap;
    y = align === 'start' ? anchor.top : align === 'end' ? anchor.bottom - size.height : anchor.top + (anchor.height - size.height) / 2;
  }
  x = Math.min(Math.max(x, margin), vw - size.width - margin);
  y = Math.min(Math.max(y, margin), vh - size.height - margin);
  return { x: Math.round(x), y: Math.round(y), side: final };
}

/** The slide a floating surface makes as it appears: a few pixels out from its anchor. */
export const ENTER_FROM: Record<Side, string> = {
  top: 'starting:translate-y-1',
  bottom: 'starting:-translate-y-1',
  left: 'starting:translate-x-1',
  right: 'starting:-translate-x-1',
};
