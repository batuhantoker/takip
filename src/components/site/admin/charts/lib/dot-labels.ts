/** A dot in screen pixels, relative to the plot's top-left corner. */
export type LabelDot = { x: number; y: number; r: number; text: string };
export type PlacedLabel = { index: number; x: number; y: number; anchor: 'start' | 'end' };

type Box = { x0: number; y0: number; x1: number; y1: number };
const hits = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * Names beside dots, in the order given (biggest first), right of the dot or else left of it, skipping any that would
 * cover another name or dot or leave the plot. Text width is estimated from its length; a dot without text only blocks.
 */
export function placeLabels(dots: LabelDot[], width: number, height: number, { charWidth = 6.2, lineHeight = 14, gap = 3, max = 40 } = {}) {
  const inside = dots.map((d, index) => ({ ...d, index })).filter(d => d.x >= 0 && d.x <= width && d.y >= 0 && d.y <= height);
  const blocked: Box[] = inside.map(d => ({ x0: d.x - d.r, y0: d.y - d.r, x1: d.x + d.r, y1: d.y + d.r }));
  const placed: PlacedLabel[] = [];
  for (const [n, d] of inside.entries()) {
    if (placed.length >= max) break;
    if (!d.text) continue;
    const w = d.text.length * charWidth;
    const y0 = d.y - lineHeight / 2;
    const sides = [
      { anchor: 'start' as const, x: d.x + d.r + gap, box: { x0: d.x + d.r + gap, y0, x1: d.x + d.r + gap + w, y1: y0 + lineHeight } },
      { anchor: 'end' as const, x: d.x - d.r - gap, box: { x0: d.x - d.r - gap - w, y0, x1: d.x - d.r - gap, y1: y0 + lineHeight } },
    ];
    const fit = sides.find(s => s.box.x0 >= 0 && s.box.x1 <= width && s.box.y0 >= 0 && s.box.y1 <= height
      && blocked.every((b, i) => i === n || !hits(s.box, b)));
    if (!fit) continue;
    blocked.push(fit.box);
    placed.push({ index: d.index, x: fit.x, y: d.y, anchor: fit.anchor });
  }
  return placed;
}
