import { describe, expect, it } from 'vitest';
import { assessFlow, chooseBasis, type DailyTransit } from './flow';

const LATEST = Date.UTC(2026, 9, 4);

/** `days` consecutive days ending 2026-10-04; `make` gets each day's age (0 = latest). */
function series(days: number, make: (age: number) => Partial<DailyTransit>): DailyTransit[] {
  return Array.from({ length: days }, (_, i) => {
    const age = days - 1 - i;
    return {
      date: new Date(LATEST - age * 86_400_000).toISOString().slice(0, 10),
      total: 40,
      tanker: 15,
      cargo: 25,
      tankerCapacity: 700_000,
      ...make(age),
    };
  });
}

describe('chooseBasis', () => {
  it('uses tanker capacity when exactly half the baseline days carry it', () => {
    const days = series(20, age => ({ tankerCapacity: age % 2 ? 0 : 500_000 }));
    expect(chooseBasis(days)).toBe('capacity');
  });

  it('falls back to counts below half', () => {
    const days = series(20, age => ({ tankerCapacity: age < 9 ? 500_000 : 0 }));
    expect(chooseBasis(days)).toBe('count');
    expect(chooseBasis([])).toBe('count');
  });
});

describe('assessFlow', () => {
  it('reads a steady chokepoint as normal at ratio 1', () => {
    expect(assessFlow(series(121, () => ({})))).toEqual({
      latestDate: '2026-10-04',
      last7Mean: 700_000,
      baselineMean: 700_000,
      ratio: 1,
      basis: 'capacity',
      status: 'normal',
    });
  });

  it('anchors the windows to the latest row, not to today', () => {
    const shuffled = series(121, () => ({})).reverse();
    expect(assessFlow(shuffled)).toMatchObject({ latestDate: '2026-10-04', status: 'normal' });
  });

  it('flags three straight days under 85% of baseline as disrupted', () => {
    const r = assessFlow(series(121, age => (age < 3 ? { tankerCapacity: 500_000 } : {})));
    expect(r.status).toBe('disrupted');
    expect(r.ratio).toBeCloseTo((3 * 500_000 + 4 * 700_000) / 7 / 700_000, 3);
  });

  it('stays normal when one of the last three days recovers', () => {
    const r = assessFlow(series(121, age => (age < 3 && age !== 1 ? { tankerCapacity: 100_000 } : {})));
    expect(r.status).toBe('normal');
    expect(r.ratio).toBeLessThan(1);
  });

  it('clamps a surge to 1.5', () => {
    const r = assessFlow(series(121, age => (age < 7 ? { tankerCapacity: 7_000_000 } : {})));
    expect(r).toMatchObject({ ratio: 1.5, status: 'normal' });
    expect(r.last7Mean).toBe(7_000_000);
  });

  it('switches to total counts when tanker capacity is mostly missing', () => {
    const r = assessFlow(series(121, age => ({ tankerCapacity: age % 3 ? 0 : 200_000, total: age < 7 ? 20 : 40 })));
    expect(r).toMatchObject({ basis: 'count', last7Mean: 20, baselineMean: 40, ratio: 0.5, status: 'disrupted' });
  });

  it('ignores rows older than the baseline window', () => {
    const r = assessFlow(series(200, age => (age >= 97 ? { tankerCapacity: 9_000_000 } : {})));
    expect(r.baselineMean).toBe(700_000);
  });

  it('is insufficient with fewer than 40 days of history', () => {
    expect(assessFlow(series(39, () => ({})))).toMatchObject({ ratio: null, status: 'insufficient', latestDate: '2026-10-04' });
    expect(assessFlow(series(40, () => ({}))).status).toBe('normal');
  });

  it('is insufficient with fewer than 3 recent days', () => {
    const days = series(121, () => ({})).filter((_, i, all) => i < all.length - 7 || i >= all.length - 2);
    expect(assessFlow(days)).toMatchObject({ ratio: null, status: 'insufficient' });
  });

  it('is insufficient with fewer than 20 baseline days, however long the history', () => {
    const days = series(160, () => ({})).filter((_, i, all) => {
      const age = all.length - 1 - i;
      return age < 7 || age >= 97 || age % 5 === 0;
    });
    expect(days.length).toBeGreaterThan(60);
    expect(assessFlow(days)).toMatchObject({ ratio: null, status: 'insufficient' });
  });

  it('is insufficient on a Kerch-shaped trickle instead of reporting a disruption', () => {
    // Live Kerch, 2026-10-04: ~1.2 vessels a day in the baseline, none in the last week.
    const trickle = (scale: number) => series(121, age => ({ total: age < 7 ? 0 : scale * (age % 5 ? 1 : 2), tanker: 0, tankerCapacity: 0 }));
    expect(assessFlow(trickle(1))).toMatchObject({ basis: 'count', baselineMean: 1.2, ratio: null, status: 'insufficient' });
    expect(assessFlow(trickle(2))).toMatchObject({ basis: 'count', ratio: 0, status: 'disrupted' });
  });

  it('is insufficient on an empty series', () => {
    expect(assessFlow([])).toEqual({
      latestDate: null, last7Mean: null, baselineMean: null, ratio: null, basis: 'count', status: 'insufficient',
    });
  });
});
