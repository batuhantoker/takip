import { describe, expect, it } from 'vitest';
import { centre, countBy, densest, movers, rankOf, sampleYears, spokenNumber, valuesAt } from './facts';

describe('centre', () => {
  it('averages longitude on the circle, across the antimeridian', () => {
    const [lat, lon] = centre([{ t: 0, lat: 10, lon: 170 }, { t: 0, lat: 20, lon: -170 }])!;
    expect(lat).toBe(15);
    expect(Math.abs(lon)).toBeCloseTo(180, 5);
  });
  it('is null for nothing', () => expect(centre([])).toBeNull());
});

describe('densest', () => {
  it('looks where most points are, not between clusters', () => {
    const pts = [...Array(5)].map(() => ({ t: 0, lat: 37, lon: -116 })).concat([{ t: 0, lat: 50, lon: 78 }]);
    expect(densest(pts)).toEqual([37, -116]);
  });
});

describe('countBy', () => {
  it('counts, most first, skipping nulls', () => {
    expect(countBy(['a', 'b', 'a', null], x => x)).toEqual([['a', 2], ['b', 1]]);
  });
});

describe('sampleYears', () => {
  it('keeps the ends and rounds the middle', () => {
    expect(sampleYears(1950, 2100, 4)).toEqual([1950, 2000, 2050, 2100]);
    expect(sampleYears(1945, 1998, 3)).toEqual([1945, 1970, 1998]);
  });
});

describe('rankings', () => {
  const series = { A: [[2000, 5], [2050, 6]], B: [[2000, 3], [2050, 9]], C: [[2000, 4]] } as Record<string, [number, number][]>;
  it('ranks a year, top first', () => {
    expect(valuesAt(series, 2000).map(r => r.key)).toEqual(['A', 'C', 'B']);
    expect(rankOf(valuesAt(series, 2050), 'B')).toBe(1);
    expect(rankOf(valuesAt(series, 2050), 'C')).toBeNull();
  });
  it('finds the biggest risers by ratio', () => {
    expect(movers(valuesAt(series, 2000), valuesAt(series, 2050), 1, 'up')[0]).toEqual({ key: 'B', from: 3, to: 9 });
  });
});

describe('spokenNumber', () => {
  it('says big numbers in words and small ones plainly', () => {
    expect(spokenNumber(1_412_000_000)).toBe('1.4 billion');
    expect(spokenNumber(72.46)).toBe('72.5');
    expect(spokenNumber(3200)).toBe('3,200');
  });
});
