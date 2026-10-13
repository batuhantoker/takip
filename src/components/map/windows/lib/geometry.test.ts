import { describe, expect, it } from 'vitest';
import { clampRect, GAP, resizeRect, snapRect, stackColumn, type Area } from './geometry';

const area: Area = { left: 72, top: 0, right: 1512, bottom: 872 };
const lim = { minW: 280, minH: 160, maxW: 900, maxH: 800 };

describe('clampRect', () => {
  it('keeps a window inside the map area', () => {
    expect(clampRect({ x: 1400, y: 850, w: 340, h: 200 }, area)).toEqual({ x: 1172, y: 672, w: 340, h: 200 });
    expect(clampRect({ x: 0, y: -40, w: 340, h: 200 }, area)).toMatchObject({ x: 72, y: 0 });
  });
});

describe('stackColumn', () => {
  it('stacks newest first with the gap between', () => {
    const s = stackColumn([
      { id: 'a', want: 200, head: 52, folded: false },
      { id: 'b', want: 300, head: 52, folded: false },
    ], 12, 660);
    expect(s).toEqual([
      { id: 'a', y: 12, h: 200, collapsed: false },
      { id: 'b', y: 12 + 200 + GAP, h: 300, collapsed: false },
    ]);
  });
  it('folds older windows to their header when the column runs out', () => {
    const s = stackColumn([
      { id: 'a', want: 400, head: 52, folded: false },
      { id: 'b', want: 400, head: 52, folded: false },
      { id: 'c', want: 400, head: 44, folded: false },
    ], 12, 660);
    expect(s.map(x => x.collapsed)).toEqual([false, true, true]);
    expect(s[2].y + s[2].h).toBeLessThanOrEqual(660);
  });
  it('opens an older window scrolling when a fair amount of room is left', () => {
    const s = stackColumn([
      { id: 'cam', want: 240, head: 44, folded: false },
      { id: 'a', want: 420, head: 52, folded: false },
      { id: 'b', want: 420, head: 52, folded: false },
    ], 12, 668);
    expect(s[1]).toMatchObject({ collapsed: false, h: 668 - (12 + 240 + GAP) - (52 + GAP) });
    expect(s[2].collapsed).toBe(true);
  });
  it('lets the newest scroll inside when it is taller than the column', () => {
    const s = stackColumn([{ id: 'a', want: 900, head: 52, folded: false }, { id: 'b', want: 100, head: 52, folded: false }], 12, 660);
    expect(s[0]).toMatchObject({ collapsed: false, h: 660 - 12 - 52 - GAP });
    expect(s[1].collapsed).toBe(true);
  });
  it('keeps a window the person folded folded', () => {
    expect(stackColumn([{ id: 'a', want: 100, head: 52, folded: true }], 12, 660)[0]).toMatchObject({ h: 52, collapsed: true });
  });
});

describe('snapRect', () => {
  const other = { id: 'o', x: 600, y: 100, w: 340, h: 300 };
  it('pulls a window flush beside a neighbour, with the gap, and attaches it', () => {
    const s = snapRect({ x: 600 + 340 + 14, y: 106, w: 340, h: 200 }, [other], area);
    expect(s).toMatchObject({ x: 600 + 340 + GAP, y: 100, attach: 'o' });
    expect(s.guides.length).toBe(2);
  });
  it('stacks under a neighbour and lines up the left edges', () => {
    const s = snapRect({ x: 604, y: 100 + 300 + 3, w: 340, h: 200 }, [other], area);
    expect(s).toMatchObject({ x: 600, y: 100 + 300 + GAP, attach: 'o' });
  });
  it('snaps to the edge of the map area', () => {
    expect(snapRect({ x: 75, y: 300, w: 340, h: 200 }, [], area)).toMatchObject({ x: 72 + GAP, attach: null });
  });
  it('leaves a window alone far from anything', () => {
    expect(snapRect({ x: 300, y: 300, w: 200, h: 200 }, [other], area)).toEqual({ x: 300, y: 300, guides: [], attach: null });
  });
});

describe('resizeRect', () => {
  const start = { x: 500, y: 200, w: 340, h: 300 };
  it('grows from the right and bottom', () => {
    expect(resizeRect(start, 'se', 60, 40, lim)).toEqual({ x: 500, y: 200, w: 400, h: 340 });
  });
  it('keeps the opposite edge still when pulled from the left or top', () => {
    expect(resizeRect(start, 'nw', -60, -40, lim)).toEqual({ x: 440, y: 160, w: 400, h: 340 });
  });
  it('stops at the minimum size', () => {
    expect(resizeRect(start, 'e', -500, 0, lim).w).toBe(280);
  });
  it('keeps a video at 16:9 from a corner', () => {
    const chrome = 44;
    const r = resizeRect({ x: 500, y: 200, w: 440, h: chrome + 248 }, 'se', 160, 10, { ...lim, minW: 320 }, chrome);
    expect(r.w).toBe(600);
    expect(r.h).toBe(chrome + Math.round((600 * 9) / 16));
  });
});
