import { describe, expect, it } from 'vitest';
import { createCountryChart, MAX_CHARTED } from './chart';

describe('createCountryChart', () => {
  it('adds a country on the first click and drops it on the second', () => {
    const chart = createCountryChart();
    let calls = 0;
    chart.subscribe(() => calls++);
    expect(chart.toggle('FRA', 'France')).toBe(true);
    expect(chart.countries()).toEqual([{ key: 'FRA', name: 'France', slot: 0 }]);
    chart.toggle('FRA', 'France');
    expect(chart.countries()).toEqual([]);
    expect(calls).toBe(2);
  });

  it('keeps each colour with its country and reuses the lowest free slot', () => {
    const chart = createCountryChart();
    for (const k of ['A', 'B', 'C']) chart.toggle(k, k);
    chart.remove('A');
    expect(chart.countries().map(c => [c.key, c.slot])).toEqual([['B', 1], ['C', 2]]);
    chart.toggle('D', 'D');
    expect(chart.countries().find(c => c.key === 'D')?.slot).toBe(0);
  });

  it('refuses a country past the cap', () => {
    const chart = createCountryChart();
    for (let i = 0; i < MAX_CHARTED; i++) chart.toggle(`K${i}`, `K${i}`);
    expect(chart.toggle('X', 'X')).toBe(false);
    expect(chart.countries()).toHaveLength(MAX_CHARTED);
    chart.clear();
    expect(chart.countries()).toEqual([]);
  });
});
