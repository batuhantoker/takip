import { describe, expect, it } from 'vitest';
import { auroraHasPage, auroraIndexCandidate, issBestElevation, issIndexCandidate, issReaches, kmBetween, thinOut } from './sky-rules';

describe('issBestElevation', () => {
  it('lets the station pass overhead anywhere within its inclination', () => {
    expect(issBestElevation(0)).toBe(90);
    expect(issBestElevation(-51)).toBe(90);
  });

  it('keeps it low further out, and under 10° beyond about 64.5°', () => {
    // Propagating the station for ten days found 20.6° over Oslo and 10.6° over Reykjavík.
    expect(issBestElevation(59.91)).toBeGreaterThan(20.6);
    expect(issBestElevation(59.91)).toBeLessThan(22);
    expect(issReaches(64.14)).toBe(true);
    expect(issReaches(65)).toBe(false);
    expect(issBestElevation(69.65)).toBeLessThan(4);
    expect(issBestElevation(-70)).toBeCloseTo(issBestElevation(70), 6);
  });
});

describe('index rules', () => {
  it('indexes the ISS for big places it can reach', () => {
    expect(issIndexCandidate({ lat: 48.1, pop: 1_500_000 })).toBe(true);
    expect(issIndexCandidate({ lat: 48.1, pop: 99_999 })).toBe(false);
    expect(issIndexCandidate({ lat: 68.97, pop: 300_000 })).toBe(false);
  });

  it('gives the aurora a page from 50° of magnetic latitude and indexes it from 55° north and 51.5° south', () => {
    expect(auroraHasPage(52.4)).toBe(true);
    expect(auroraHasPage(-53.4)).toBe(true);
    expect(auroraHasPage(47.2)).toBe(false);
    expect(auroraIndexCandidate(67.1)).toBe(true);
    expect(auroraIndexCandidate(56.8)).toBe(true);
    expect(auroraIndexCandidate(54.9)).toBe(false);
    expect(auroraIndexCandidate(-52.7)).toBe(true);
    expect(auroraIndexCandidate(-51.4)).toBe(false);
  });
});

describe('thinOut', () => {
  const tokyo = { id: 1, lat: 35.69, lng: 139.69, pop: 8_300_000 };
  const kawasaki = { id: 2, lat: 35.52, lng: 139.7, pop: 1_500_000 };
  const yokohama = { id: 3, lat: 35.44, lng: 139.64, pop: 3_600_000 };
  const osaka = { id: 4, lat: 34.69, lng: 135.5, pop: 2_600_000 };

  it('keeps the most populous of neighbours and anything further than the radius', () => {
    expect(kmBetween(tokyo, kawasaki)).toBeLessThan(25);
    expect([...thinOut([kawasaki, osaka, yokohama, tokyo], 25)].sort()).toEqual([1, 3, 4]);
  });

  it('drops a place near a kept one even when a dropped one lies between them', () => {
    // Kawasaki goes for Tokyo, then Yokohama is measured against Tokyo, not Kawasaki.
    expect(thinOut([tokyo, kawasaki, yokohama], 20)).toEqual(new Set([1, 3]));
  });

  it('measures longitude by the km it spans near the poles', () => {
    const a = { id: 10, lat: 69.6, lng: 18.9, pop: 70_000 };
    const b = { id: 11, lat: 69.6, lng: 19.9, pop: 10_000 };
    expect(kmBetween(a, b)).toBeLessThan(50);
    expect(thinOut([a, b], 50)).toEqual(new Set([10]));
  });

  it('breaks a tie on population by the lower id', () => {
    expect(thinOut([{ ...kawasaki, id: 9, pop: 5 }, { ...kawasaki, id: 8, pop: 5 }], 25)).toEqual(new Set([8]));
  });
});
