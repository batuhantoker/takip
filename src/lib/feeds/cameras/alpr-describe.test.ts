import { describe, expect, it } from 'vitest';
import { alprFacing, alprPopupHtml, alprTip, compassPoint } from './alpr-describe';

// Shaped like a z14 DeFlock `cameras` feature.
const CHICAGO = {
  osmId: 11152172380, osmType: 'node', operator: 'Chicago Police Department', direction: 270,
  surveillanceZone: 'traffic', mountType: 'traffic_signals', osmTimestamp: '2024-08-27T18:57:29Z', osmVersion: 2,
};

describe('alprFacing', () => {
  it('names the bearing and its compass point', () => {
    expect(alprFacing({ direction: 178 })).toBe('178° S');
    expect(compassPoint(359)).toBe('N');
  });

  it('lists every distinct direction a node maps', () => {
    expect(alprFacing({ direction: 200, directions: '[200,339]' })).toBe('200° SSW, 339° NNW');
  });

  it('falls back to the mapped cardinal, and to nothing', () => {
    expect(alprFacing({ directionCardinal: 'wsw' })).toBe('WSW');
    expect(alprFacing({ directions: 'not json' })).toBeUndefined();
  });
});

describe('alprTip', () => {
  it('ignores the attribute-less density points', () => {
    expect(alprTip({})).toBeNull();
  });

  it('keys on the OSM id and reads operator, maker and facing', () => {
    expect(alprTip({ ...CHICAGO, brand: 'Motorola Solutions' })).toEqual({
      key: 'alpr:11152172380', name: 'Chicago Police Department', meta: 'Motorola Solutions · facing 270° W',
    });
    expect(alprTip({ osmId: 1, brand: '?' })?.meta).toBe('Plate reader');
  });
});

describe('alprPopupHtml', () => {
  it('links the OSM element and dates the last edit, not a survey', () => {
    const html = alprPopupHtml(CHICAGO);
    expect(html).toContain('https://www.openstreetmap.org/node/11152172380');
    expect(html).toContain('edited 2024-08-27');
    expect(html).toContain('Traffic signals');
  });

  it('escapes what volunteers typed', () => {
    expect(alprPopupHtml({ osmId: 2, operator: '<b>x</b>' })).not.toContain('<b>x</b>');
  });
});
