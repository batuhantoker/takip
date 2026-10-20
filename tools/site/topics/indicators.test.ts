import { describe, expect, it } from 'vitest';
import { indicatorSpec, type SeriesRef } from '../../../src/lib/platform/site/places/topics/indicators-data';
import { buildSeries, projectionEnd, rankYear, ranks, seriesFacts, sig, toYearly, type Points } from './indicators';

const pts = (o: Record<number, number>): Points => new Map(Object.entries(o).map(([y, v]) => [Number(y), v]));

describe('toYearly', () => {
  it('keeps gaps as null, never carrying a value forward, and rounds to four digits', () => {
    expect(toYearly(pts({ 1950: 47.2911, 1952: 48.0049, 1953: 21_020_456 }))).toEqual([1950, [47.29, null, 48, 21_020_000]]);
  });

  it('cuts to [from, before)', () => {
    expect(toYearly(pts({ 1937: 35.4, 1950: 47.3, 2024: 77.4 }), 1800, 1950)).toEqual([1937, [35.4]]);
    expect(toYearly(pts({ 1937: 35.4 }), 1950)).toBeNull();
  });
});

describe('sig', () => {
  it('rounds to four significant digits', () => {
    expect(sig(0.012345)).toBe(0.01235);
    expect(sig(-3.14159)).toBe(-3.142);
    expect(sig(0)).toBe(0);
  });
});

describe('seriesFacts', () => {
  it('finds the ends and the extremes, the earliest winning a tie', () => {
    expect(seriesFacts([2000, [5, null, 9, 9, 1]])).toEqual({ n: 4, first: [2000, 5], last: [2004, 1], max: [2002, 9], min: [2004, 1] });
  });
});

describe('rankYear and ranks', () => {
  it('ranks in the latest year at least half the countries have, highest first, ties sharing a place', () => {
    const a: [number, (number | null)[]] = [2020, [1, 2, 3]];
    const b: [number, (number | null)[]] = [2020, [4, 5, null]];
    const c: [number, (number | null)[]] = [2021, [5]];
    expect(rankYear([a, b, c])).toBe(2021);
    expect(rankYear([a, b])).toBe(2022);
    expect(rankYear([b, c])).toBe(2021);
    const r = ranks(new Map([['a', a], ['b', b], ['c', c]]), 2021);
    expect([...r]).toEqual([['b', [1, 3, 2]], ['c', [1, 3, 2]], ['a', [3, 3]]]);
  });
});

describe('projectionEnd', () => {
  it('gives the range only where both ends exist', () => {
    expect(projectionEnd([2024, [77, 88.6]], [2024, [76, 81.6]], [2024, [78, 95.9]])).toEqual([2025, 88.6, 81.6, 95.9]);
    expect(projectionEnd([2024, [77, 88.6]], [2024, [76, 81.6]])).toEqual([2025, 88.6]);
  });
});

describe('buildSeries', () => {
  const data: Record<string, Points> = {
    'wpp:LEx': pts({ 1950: 47.3, 2023: 77.2, 2024: 77.3 }),
    'wpp:LEx.proj': pts({ 2024: 77.4, 2100: 88.6 }),
    'wpp:LEx.proj.lo': pts({ 2024: 77, 2100: 81.6 }),
    'wpp:LEx.proj.hi': pts({ 2024: 77.8, 2100: 95.9 }),
    'owid:le_0': pts({ 1700: 30, 1937: 35.4, 1950: 47.7 }),
  };
  const get = (ref: SeriesRef, suffix = '') => data[`${ref.code}${suffix}`];

  it('stops the estimates where the projection starts, and the earlier run where the estimates start', () => {
    const s = buildSeries(indicatorSpec('life-expectancy')!, get)!;
    expect(s.e).toEqual([1950, [47.3, ...new Array(72).fill(null), 77.2]]);
    expect(s.p![0]).toBe(2024);
    expect(s.l).toEqual([1937, [35.4]]);
    expect(s.f).toMatchObject({ n: 2, first: [1950, 47.3], last: [2023, 77.2], proj: [2100, 88.6, 81.6, 95.9], before: [1937, 35.4] });
  });

  it('has nothing without the main series', () => {
    expect(buildSeries(indicatorSpec('life-expectancy')!, () => undefined)).toBeNull();
  });
});
