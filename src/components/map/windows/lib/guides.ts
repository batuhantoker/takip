import type { Guide, Rect } from './geometry';

let layer: HTMLDivElement | null = null;

const box = (cls: string, l: number, t: number, w: number, h: number) => {
  const d = document.createElement('div');
  d.className = cls;
  Object.assign(d.style, { left: `${l}px`, top: `${t}px`, width: `${w}px`, height: `${h}px` });
  return d;
};

/** The accent lines a drag will snap to, and the outline of the column it would dock into. */
export function drawGuides(lines: Guide[], dock: Rect | null) {
  if (!lines.length && !dock) { layer?.remove(); layer = null; return; }
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'tk-window-guides';
    document.body.appendChild(layer);
  }
  layer.replaceChildren(
    ...lines.map(g => box('tk-window-guide', Math.min(g.x1, g.x2), Math.min(g.y1, g.y2), Math.max(1, Math.abs(g.x2 - g.x1)), Math.max(1, Math.abs(g.y2 - g.y1)))),
    ...(dock ? [box('tk-window-dock', dock.x, dock.y, dock.w, dock.h)] : []),
  );
}
