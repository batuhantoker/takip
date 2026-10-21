import { describe, expect, it } from 'vitest';
import { KINDS, openWidth } from './kinds';
import type { MapArea } from './map-area';

const area = (w: number, h: number): MapArea => ({ left: 0, top: 0, right: w, bottom: h - 28, colTop: 12, colRight: w - 12, colBottom: h - 36 });

describe('openWidth', () => {
  it('opens at the kind’s own width on a full screen', () => {
    for (const kind of ['inspect', 'camera', 'live'] as const) expect(openWidth(kind, area(1440, 900))).toBe(KINDS[kind].width);
  });

  it('narrows live TV in an embed’s frame so the picture fits its height and the map shows beside it', () => {
    const frame = area(642, 360);
    const w = openWidth('live', frame);
    expect(w).toBeLessThan(KINDS.live.width);
    expect((w * 9) / 16 + 84).toBeLessThanOrEqual(frame.colBottom - frame.colTop);
    expect(frame.right - w).toBeGreaterThanOrEqual(240);
  });

  it('narrows a remembered width the same way, and never below a picture’s smallest', () => {
    expect(openWidth('live', area(642, 360), 960)).toBe(openWidth('live', area(642, 360)));
    expect(openWidth('camera', area(360, 200))).toBe(320);
  });
});
