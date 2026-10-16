import { describe, expect, it } from 'vitest';
import { LICENCES, SOURCES } from '../seed';
import { addAgeGroup, AGE_METRICS, LAST_ESTIMATE, LAST_PROJECTION, projectionOf, VARIANTS, WPP_METRICS } from './wpp';

describe('wpp', () => {
  it('splits the estimates from the medium-variant projections, which end in 2100', () => {
    expect(LAST_ESTIMATE).toBe(2023);
    expect(LAST_PROJECTION).toBe(2100);
  });

  it('keeps each variant and the 95% bounds under codes History reads as scenarios and a range', () => {
    const tfr = WPP_METRICS.find(m => m.column === 'TFR')!;
    expect(Object.values(VARIANTS).map(v => projectionOf(tfr, v).code)).toEqual([
      'wpp:TFR.proj.high', 'wpp:TFR.proj.low', 'wpp:TFR.proj.constant-fertility', 'wpp:TFR.proj.zero-migration', 'wpp:TFR.proj.hi', 'wpp:TFR.proj.lo',
    ]);
    expect(projectionOf(tfr, VARIANTS[207]).name).toBe('Fertility rate (UN projection, lower bound of the 95% prediction interval)');
  });

  it('keeps projections under their own codes, named and tagged as projections', () => {
    for (const m of WPP_METRICS) {
      const p = projectionOf(m);
      expect(p.code).toBe(`${m.code}.proj`);
      expect(p.name).toBe(`${m.name.replace(' (UN WPP)', '')} (UN projection, medium variant)`);
      expect(p.attrs).toEqual({ projection: true, variant: 'medium variant', base: m.code });
      expect({ ...p, code: m.code, name: m.name, attrs: m.attrs }).toEqual(m);
    }
  });

  it('scales the counts WPP gives in thousands, and only those', () => {
    expect(WPP_METRICS.filter(m => m.scale).map(m => m.column)).toEqual(['TPopulation1July', 'Births', 'Deaths', 'NetMigrations']);
    for (const m of WPP_METRICS.filter(x => x.scale)) expect(m).toMatchObject({ agg: 'sum', scale: 1000 });
    expect(WPP_METRICS.find(m => m.column === 'TPopulation1July')).toMatchObject({ unit: 'people', agg: 'sum', scale: 1000 });
  });

  it('names every metric under its own wpp: code', () => {
    expect(new Set(WPP_METRICS.map(m => m.code)).size).toBe(WPP_METRICS.length);
    for (const m of WPP_METRICS) expect(m.code).toBe(`wpp:${m.column}`);
  });

  it('sums the age groups into shares and the 65+ per 20–64 ratio', () => {
    const b = { total: 0, under15: 0, working: 0, over65: 0 };
    for (const [start, pop] of [[0, 10], [5, 10], [10, 10], [15, 10], [20, 30], [60, 10], [65, 15], [100, 5]]) addAgeGroup(b, start, pop);
    const [share65, share0_14, dep] = AGE_METRICS.map(m => m.of(b));
    expect(share65).toBeCloseTo(20, 9);
    expect(share0_14).toBeCloseTo(30, 9);
    expect(dep).toBeCloseTo(50, 9);
  });

  it('is seeded under its owner, with a licence that allows commercial use', () => {
    const source = SOURCES.find(s => s.code === 'wpp-2024');
    expect(source?.owner).toBe('UN DESA, Population Division');
    expect(LICENCES.find(l => l.code === source?.licence)?.commercial).toBe(1);
  });
});
