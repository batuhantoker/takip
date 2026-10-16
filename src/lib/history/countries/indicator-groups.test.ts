import { describe, expect, it } from 'vitest';
import { curatedLabel, filterIndicators, groupIndicators, placeOf, STARTERS, SUGGESTED, suggestedGroup, undated, withProjections, yearSpan } from './indicator-groups';
import type { CatalogueMetric } from '../series';

const metric = (code: string, name: string, topic: string | null): CatalogueMetric => ({ code, name, unit: null, topic, subjects: 200 });

const CATALOGUE = [
  metric('wdi:SP.DYN.IMRT.IN', 'Mortality rate, infant (per 1,000 live births)', 'Health: Mortality'),
  metric('wdi:SP.POP.65UP.TO.ZS', 'Population ages 65 and above (% of total population)', 'Health: Population: Structure'),
  metric('wdi:NY.GDP.PCAP.KD', 'GDP per capita (constant 2015 US$)', 'Economic Policy & Debt: National accounts: US$ at constant 2015 prices: Aggregate indicators'),
  metric('wdi:NE.EXP.GNFS.ZS', 'Exports of goods and services (% of GDP)', 'Trade'),
  metric('wdi:XX.NEW', 'Something new', 'Space: Launches'),
  metric('owid:le_0', 'Life expectancy at birth', 'health'),
  metric('owid:prev_depression', 'Prevalence: depression', 'mental_health'),
  metric('owid:population', 'Population', 'population'),
  metric('x:untopical', 'Untopical', null),
];

describe('placeOf', () => {
  it('files a WDI path under its area, with the next part as the section', () => {
    expect(placeOf('Health: Mortality')).toEqual({ group: 'Health', section: 'Mortality' });
    expect(placeOf('Economic Policy & Debt: External debt: Net flows')).toEqual({ group: 'Economy', section: 'External debt' });
  });

  it('moves the topics that belong elsewhere', () => {
    expect(placeOf('Health: Population: Dynamics')).toEqual({ group: 'People', section: 'Population dynamics' });
    expect(placeOf('Public Sector: Defense & arms trade')).toEqual({ group: 'Conflict', section: 'Defense & arms trade' });
    expect(placeOf('Policy & institutions: Rule of Law')).toEqual({ group: 'Politics and government', section: 'Governance indicators' });
  });

  it('merges OWID and WPP slugs into the same groups', () => {
    expect(placeOf('health')).toEqual({ group: 'Health', section: null });
    expect(placeOf('mental_health')).toEqual({ group: 'Health', section: 'Mental health' });
    expect(placeOf('population')).toEqual({ group: 'People', section: null });
  });

  it('matches a prefix by whole parts only', () => {
    expect(placeOf('Trade')).toEqual({ group: 'Trade and business', section: null });
    expect(placeOf('Private Sector & Trade: Exports')).toEqual({ group: 'Trade and business', section: 'Exports' });
  });

  it('keeps an unknown area as its own group and a missing topic under Other', () => {
    expect(placeOf('Space: Launches')).toEqual({ group: 'Space', section: 'Launches' });
    expect(placeOf(null)).toEqual({ group: 'Other', section: null });
  });
});

describe('groupIndicators', () => {
  const groups = groupIndicators(CATALOGUE);

  it('orders the groups, with unknown areas after the known ones and Other last', () => {
    expect(groups.map(g => g.title)).toEqual(['Health', 'People', 'Economy', 'Trade and business', 'Space', 'Other']);
  });

  it('puts the untitled section first and counts every metric once', () => {
    const health = groups.find(g => g.title === 'Health')!;
    expect(health.sections.map(s => s.label)).toEqual([null, 'Mental health', 'Mortality']);
    expect(health.count).toBe(3);
    expect(groups.reduce((n, g) => n + g.count, 0)).toBe(CATALOGUE.length);
  });
});

describe('suggestedGroup', () => {
  it('keeps the curated labels and drops picks the catalogue lacks', () => {
    const s = suggestedGroup(CATALOGUE);
    expect(s.id).toBe(SUGGESTED);
    const rows = s.sections.flatMap(x => x.metrics);
    expect(rows.find(m => m.code === 'owid:le_0')?.name).toBe('Life expectancy, since 1543');
    expect(rows.find(m => m.code === 'wdi:NY.GDP.PCAP.KD')?.name).toBe('GDP per person');
    expect(rows.some(m => m.code === 'wpp:LEx')).toBe(false);
    expect(s.count).toBe(rows.length);
  });
});

describe('filterIndicators', () => {
  const groups = groupIndicators(CATALOGUE);

  it('needs every word, in the name, code, group or section', () => {
    expect(filterIndicators(groups, 'gdp capita').flatMap(g => g.sections.flatMap(s => s.metrics.map(m => m.code)))).toEqual(['wdi:NY.GDP.PCAP.KD']);
    expect(filterIndicators(groups, 'SP.DYN').map(g => g.title)).toEqual(['Health']);
    expect(filterIndicators(groups, 'mental depression')[0].count).toBe(1);
  });

  it('counts only the matches and drops empty groups and sections', () => {
    const [health, ...rest] = filterIndicators(groups, 'mortality');
    expect(health.count).toBe(1);
    expect(health.sections.map(s => s.label)).toEqual(['Mortality']);
    expect(rest).toEqual([]);
  });

  it('returns every group for an empty query', () => {
    expect(filterIndicators(groups, '  ')).toEqual(groups);
  });
});

describe('STARTERS', () => {
  it('are curated picks, so they carry the friendly labels', () => {
    expect(STARTERS.map(c => curatedLabel(c, true))).toEqual(['Life expectancy', 'GDP per person', 'Population']);
  });
});

describe('undated', () => {
  it('drops the start year a label carries, leaving the rest', () => {
    expect(undated('Population, since 10,000 BCE')).toBe('Population');
    expect(undated('Life expectancy')).toBe('Life expectancy');
    expect(undated('Life expectancy, projected to 2100')).toBe('Life expectancy');
  });
});

describe('yearSpan', () => {
  it('names the years an indicator covers', () => {
    expect(yearSpan([1960, 2024])).toBe('1960–2024');
    expect(yearSpan([1, 2022])).toBe('1 CE–2022');
    expect(yearSpan([-499, 1900])).toBe('500 BCE–1900');
    expect(yearSpan([-9999, 2019])).toBe('10,000 BCE–2019');
    expect(yearSpan([2020.03, 2026.66])).toBe('2020–2026');
    expect(yearSpan([2019, 2019])).toBe('2019');
    expect(yearSpan([1950, 2023], 2100)).toBe('1950–2023, projected to 2100');
    expect(yearSpan([1950, 2023], 2023)).toBe('1950–2023');
  });
});

describe('withProjections', () => {
  it('folds each projection into the estimates it extends, as how far its years reach', () => {
    const at = (code: string, years: [number, number]) => ({ ...metric(code, code, 'population'), years });
    const out = withProjections([at('wpp:TFR', [1950, 2023]), at('wpp:TFR.proj', [2024, 2100]), at('wpp:TFR.proj.high', [2024, 2100]), at('wdi:X', [1960, 2024])]);
    expect(out.map(m => [m.code, m.projectedTo])).toEqual([['wpp:TFR', 2100], ['wdi:X', undefined]]);
  });
});
