import { describe, expect, it } from 'vitest';
import { ALL_ZOOM, FIRST_ZOOM, shownFrom } from './zoom';

describe('shownFrom', () => {
  it('shows the best known in a patch first and its neighbours as the map zooms in', () => {
    const items = [{ at: [2.35, 48.85] as const, l: 10 }, { at: [2.3501, 48.8501] as const, l: 90 }];
    const [minor, famous] = shownFrom(items);
    expect(famous).toBe(FIRST_ZOOM);
    expect(minor).toBeGreaterThan(FIRST_ZOOM);
    expect(minor).toBeLessThanOrEqual(ALL_ZOOM);
  });

  it('shows places far apart from the first zoom', () => {
    const from = shownFrom([{ at: [2.35, 48.85], l: 5 }, { at: [139.7, 35.7], l: 4 }, { at: [-74, 40.7], l: 3 }]);
    expect([...from]).toEqual([FIRST_ZOOM, FIRST_ZOOM, FIRST_ZOOM]);
  });

  it('keeps one place per patch, so a dense centre fills in only up close', () => {
    const dense = Array.from({ length: 200 }, (_, i) => ({ at: [2.35 + (i % 20) * 0.0005, 48.85 + Math.floor(i / 20) * 0.0005] as const, l: 200 - i }));
    const from = shownFrom(dense);
    expect(from.filter(z => z === FIRST_ZOOM)).toHaveLength(1);
    expect(from.filter(z => z <= 10).length).toBeLessThan(10);
  });
});
