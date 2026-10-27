import { describe, expect, it } from 'vitest';
import { placeLabels } from './dot-labels';

describe('placeLabels', () => {
  it('names a dot to its right when there is room', () => {
    expect(placeLabels([{ x: 10, y: 50, r: 4, text: 'Oslo' }], 200, 100)).toEqual([{ index: 0, x: 17, y: 50, anchor: 'start' }]);
  });

  it('falls back to the left at the right edge', () => {
    expect(placeLabels([{ x: 190, y: 50, r: 4, text: 'Oslo' }], 200, 100)).toEqual([{ index: 0, x: 183, y: 50, anchor: 'end' }]);
  });

  it('skips a name that would cover a bigger one or another dot', () => {
    const placed = placeLabels([
      { x: 50, y: 50, r: 6, text: 'Istanbul' },
      { x: 52, y: 52, r: 3, text: 'Kadıköy' },
      { x: 120, y: 80, r: 3, text: 'Bursa' },
    ], 200, 100);
    expect(placed.map(p => p.index)).toEqual([0, 2]);
  });

  it('leaves out dots outside the plot and dots without text', () => {
    expect(placeLabels([{ x: -5, y: 50, r: 3, text: 'Off' }, { x: 50, y: 50, r: 3, text: '' }], 200, 100)).toEqual([]);
  });
});
