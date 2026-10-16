import { describe, expect, it } from 'vitest';
import { flyPath } from './fly-path';

const AU = 1.496e8, LY = 9.461e12;

describe('fly path', () => {
  it('starts and ends on the two views', () => {
    const p = flyPath(20_000, 30_000, 2 * AU);
    expect(p.at(0).w).toBeCloseTo(20_000, 3);
    expect(p.at(0).u).toBeCloseTo(0, 9);
    expect(p.at(1)).toEqual({ w: 30_000, u: 1 });
  });

  it('rises between two close views far apart until both ends fit', () => {
    const p = flyPath(20_000, 30_000, 2 * AU);
    const top = Math.max(...Array.from({ length: 101 }, (_, i) => p.at(i / 100).w));
    expect(top).toBeGreaterThan(AU);
  });

  it('closes the gap early when coming down from far out', () => {
    const p = flyPath(1e5 * LY, 30_000, 26_000 * LY);
    for (let i = 1; i < 100; i++) {
      const { w, u } = p.at(i / 100);
      // The destination never leaves the view on the way down.
      expect((1 - u) * 26_000 * LY).toBeLessThan(w);
    }
    expect(Number.isFinite(p.length)).toBe(true);
  });

  it('zooms evenly in log space with no gap', () => {
    const p = flyPath(150_000, 30_000, 0);
    expect(p.at(0.5).w).toBeCloseTo(Math.sqrt(150_000 * 30_000), 3);
    expect(p.length).toBeCloseTo(Math.log(5) / 1.42, 9);
  });
});
