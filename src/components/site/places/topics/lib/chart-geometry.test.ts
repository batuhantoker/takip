import { describe, expect, it } from 'vitest';
import { bandPath, domainOf, linePath, niceTicks, scales, yearTicks } from './chart-geometry';

describe('domainOf', () => {
  it('spans every series and opens to zero where the values sit near it', () => {
    expect(domainOf([[1950, [47, 77]], [2024, [77, 88]]])).toEqual({ x: [1950, 2025], y: [47, 88] });
    expect(domainOf([[2000, [10, 50]]])).toEqual({ x: [2000, 2001], y: [0, 50] });
    expect(domainOf([[2000, [-2, 3]]])!.y).toEqual([-2, 3]);
    expect(domainOf([undefined])).toBeNull();
  });

  it('gives a flat series room', () => {
    expect(domainOf([[2000, [5, 5]]])!.y).toEqual([4.5, 5.5]);
  });
});

describe('niceTicks', () => {
  it('steps in round numbers past both ends', () => {
    expect(niceTicks(47, 88)).toEqual([40, 60, 80, 100]);
    expect(niceTicks(0, 1)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(niceTicks(-2.4, 3.1)).toEqual([-4, -2, 0, 2, 4]);
  });
});

describe('yearTicks', () => {
  it('labels round years inside the span', () => {
    expect(yearTicks(1950, 2100)).toEqual([1950, 2000, 2050, 2100]);
    expect(yearTicks(1800, 2023)).toEqual([1800, 1850, 1900, 1950, 2000]);
    expect(yearTicks(2015, 2024)).toEqual([2016, 2018, 2020, 2022, 2024]);
  });
});

describe('linePath and bandPath', () => {
  const s = scales({ x: [2000, 2020], y: [0, 100] });

  it('breaks a line across a gap of more than ten years and draws a lone point as a dot', () => {
    expect(linePath([[2000, 0], [2001, 50], [2020, 100]], s)).toBe('M0 1000l0 0L50 500M1000 0l0 0');
  });

  it('closes the band over the years both ends have', () => {
    expect(bandPath([2000, [10, 20, 30]], [2001, [40, 50]], s)).toBe('M50 600L100 500L100 700L50 800Z');
  });
});
