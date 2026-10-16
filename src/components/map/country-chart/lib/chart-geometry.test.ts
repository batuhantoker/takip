import { describe, expect, it } from 'vitest';
import { clampRange, extentOf, labelsThatFit, runsOf, timeOf, timeTicks, valueAxis, visibleValues, zoomAround } from './chart-geometry';

describe('timeOf', () => {
  it('puts a yearly value mid-year and a dated one on its date', () => {
    expect(timeOf(1950)).toBe(1950.5);
    expect(timeOf(2020.25, 'day')).toBe(2020.25);
  });
});

describe('valueAxis', () => {
  it('rounds a linear axis out to even ticks', () => {
    const a = valueAxis([37, 71, 44])!;
    expect([a.lo, a.hi]).toEqual([20, 80]);
    expect(a.ticks).toEqual([20, 40, 60, 80]);
    expect(a.norm(20)).toBe(0);
    expect(a.norm(80)).toBe(1);
  });

  it('ticks a log axis at powers of ten from zero', () => {
    const a = valueAxis([0.4, 820, 61_000], true)!;
    expect(a.log).toBe(true);
    expect([a.lo, a.hi]).toEqual([0, 100_000]);
    expect(a.ticks).toEqual([0, 10, 1000, 100_000]);
    expect(a.norm(0)).toBe(0);
    expect(a.norm(100_000)).toBeCloseTo(1);
  });

  it('opens a flat series around its value, and has nothing to say about no values', () => {
    const a = valueAxis([5, 5])!;
    expect(a.lo).toBeLessThan(5);
    expect(a.hi).toBeGreaterThan(5);
    expect(valueAxis([])).toBeNull();
  });
});

describe('runsOf', () => {
  it('breaks a line where the map would show no data', () => {
    const runs = runsOf([[1900, 1], [1905, 2], [1930, 3], [1931, 4]]);
    expect(runs.map(r => r.points.map(p => p[0]))).toEqual([[1900.5, 1905.5], [1930.5, 1931.5]]);
  });

  it('starts a separate run where projections begin', () => {
    const runs = runsOf([[2022, 1], [2023, 2], [2024, 3], [2025, 4]], 'year', 2024);
    expect(runs.map(r => [r.projected, r.points.length])).toEqual([[false, 2], [true, 2]]);
  });

  it('bridges weekly points but not two months apart', () => {
    const w = 7 / 365.25;
    const runs = runsOf([[2020, 1], [2020 + w, 2], [2020 + 70 / 365.25, 3]], 'day');
    expect(runs.map(r => r.points.length)).toEqual([2, 1]);
  });
});

describe('timeTicks', () => {
  it('picks round years for the span', () => {
    expect(timeTicks(1960, 2024)).toEqual([1960, 1980, 2000, 2020]);
    expect(timeTicks(1, 2022)).toEqual([500, 1000, 1500, 2000]);
    expect(timeTicks(2020.1, 2023.6)).toEqual([2021, 2022, 2023]);
  });
});

describe('labelsThatFit', () => {
  it('drops a label that would sit on the one above it', () => {
    const kept = labelsThatFit([{ y: 50, k: 'a' }, { y: 10, k: 'b' }, { y: 55, k: 'c' }, { y: 80, k: 'd' }]);
    expect(kept.map(h => h.k)).toEqual(['b', 'a', 'd']);
  });
});

describe('zoom', () => {
  it('covers a set of series to the end of the last year', () => {
    expect(extentOf([[[1950, 1], [1960, 2]], [[1940, 1]], []])).toEqual([1940, 1961]);
    expect(extentOf([])).toBeNull();
  });

  it('keeps the points in view and the ones its lines run to', () => {
    const points: [number, number][] = [[1900, 1], [1910, 2], [1920, 3], [1930, 4], [1940, 5]];
    expect(visibleValues(points, 'year', [1912, 1925])).toEqual([2, 3, 4]);
  });

  it('zooms about the pointer', () => {
    expect(zoomAround([1900, 2000], 1950, 0.5)).toEqual([1925, 1975]);
    expect(zoomAround([1900, 2000], 1900, 0.5)).toEqual([1900, 1950]);
  });

  it('keeps a view inside the data, wide enough, and lets go of it once it covers everything', () => {
    expect(clampRange([1990, 1950], [1900, 2000], 3)).toEqual([1950, 1990]);
    expect(clampRange([1880, 1920], [1900, 2000], 3)).toEqual([1900, 1940]);
    expect(clampRange([1950, 1951], [1900, 2000], 3)).toEqual([1949, 1952]);
    expect(clampRange([1850, 2050], [1900, 2000], 3)).toBeNull();
  });
});
