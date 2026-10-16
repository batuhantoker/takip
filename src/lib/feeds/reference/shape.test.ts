import { describe, expect, it } from 'vitest';
import { clipLine, clipLineFeature } from './clip';
import { metresPerPixel, simplifyLine } from './simplify';

describe('clipLine', () => {
  const box = [0, 0, 10, 10] as [number, number, number, number];

  it('keeps a line that is entirely inside', () => {
    expect(clipLine([[1, 1], [5, 5], [9, 1]], box)).toEqual([[[1, 1], [5, 5], [9, 1]]]);
  });

  it('cuts a line where it crosses the edge', () => {
    expect(clipLine([[-10, 5], [20, 5]], box)).toEqual([[[0, 5], [10, 5]]]);
  });

  it('splits a line that leaves and comes back into two pieces', () => {
    expect(clipLine([[5, 5], [15, 5], [15, 8], [5, 8]], box)).toEqual([[[5, 5], [10, 5]], [[10, 8], [5, 8]]]);
  });

  it('returns nothing for a line that only passes nearby', () => {
    expect(clipLine([[-5, -5], [-5, 20]], box)).toEqual([]);
  });
});

describe('clipLineFeature', () => {
  it('turns a route clipped into several pieces into a MultiLineString', () => {
    const f = { geometry: { type: 'LineString', coordinates: [[5, 5], [15, 5], [15, 8], [5, 8]] as unknown } };
    expect(clipLineFeature(f, [[0, 0, 10, 10]])).toBe(true);
    expect(f.geometry.type).toBe('MultiLineString');
  });

  it('reports false when no part of the line is in view', () => {
    const f = { geometry: { type: 'LineString', coordinates: [[20, 20], [30, 30]] as unknown } };
    expect(clipLineFeature(f, [[0, 0, 10, 10]])).toBe(false);
  });
});

describe('simplifyLine', () => {
  it('drops points that sit on a straight line', () => {
    const line = Array.from({ length: 50 }, (_, i) => [i * 0.01, 40]);
    expect(simplifyLine(line, 10)).toEqual([line[0], line[49]]);
  });

  it('keeps a bend larger than the tolerance and drops one smaller than it', () => {
    // 0.001° of latitude is ~110 m.
    const bend = [[0, 40], [0.05, 40.001], [0.1, 40]];
    expect(simplifyLine(bend, 50)).toHaveLength(3);
    expect(simplifyLine(bend, 500)).toHaveLength(2);
  });

  it('measures ground metres per 512 px tile pixel at the equator', () => {
    expect(metresPerPixel(8)).toBeCloseTo(305.75, 1);
    expect(metresPerPixel(10)).toBeCloseTo(76.44, 1);
  });
});
