import { describe, expect, it } from 'vitest';
import { countryPath } from './country-path';

describe('countryPath', () => {
  it('projects rings like the land path and drops repeats after rounding', () => {
    const square = [[0, 0], [1, 0], [1.01, 0], [1, 1], [0, 1], [0, 0]];
    expect(countryPath({ features: [{ geometry: { type: 'Polygon', coordinates: [square] } }] }))
      .toBe('M180 90L181 90L181 89L180 89L180 90Z');
  });

  it('reads multipolygons and skips empty geometry', () => {
    const tri = [[10, 10], [11, 10], [10, 11]];
    expect(countryPath({ features: [
      { geometry: { type: 'MultiPolygon', coordinates: [[tri], [tri]] } },
      { geometry: null },
    ] })).toBe('M190 80L191 80L190 79ZM190 80L191 80L190 79Z');
  });
});
