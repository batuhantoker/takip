import { describe, expect, it } from 'vitest';
import { outbreakFeatures, outbreakPopupHtml, type OutbreakRow } from './outbreaks';

const CDC: OutbreakRow = {
  id: 'cdc-ebola-cd', disease: 'Ebola', country: 'Democratic Republic of the Congo', iso2: 'CD', lat: -3, lng: 24,
  title: 'Level 4 - Ebola in Ituri and Nord-Kivu', url: 'https://wwwnc.cdc.gov/travel/notices/level4/ebola-drc',
  published: '2026-09-20T00:00:00.000Z', source: 'CDC', level: 4,
};
const WHO: OutbreakRow = { ...CDC, id: 'who-ebola-cd', source: 'WHO', level: null, title: 'Ebola virus disease - DRC', published: '2026-10-08T00:00:00.000Z' };
const MPOX: OutbreakRow = { ...WHO, id: 'who-mpox-cd', disease: 'Mpox' };

describe('outbreakFeatures', () => {
  it('folds every notice for a country into one ring, graded by its highest CDC level', () => {
    const fs = outbreakFeatures([CDC, WHO, MPOX]);
    expect(fs).toHaveLength(1);
    expect(fs[0].properties).toMatchObject({ level: 4, color: '#FF1744', count: 2, label: 'Democratic Republic of the Congo: Ebola, Mpox' });
  });

  it('leaves an ungraded country ungraded', () => {
    expect(outbreakFeatures([WHO])[0].properties).toMatchObject({ level: null, color: '#C5E1A5' });
  });
});

describe('outbreakPopupHtml', () => {
  it('lists the graded notice first and says the place is country-level', () => {
    const html = outbreakPopupHtml(outbreakFeatures([WHO, CDC])[0].properties ?? {});
    expect(html.indexOf('CDC level 4')).toBeGreaterThan(-1);
    expect(html.indexOf('CDC level 4')).toBeLessThan(html.indexOf('WHO ·'));
    expect(html).toContain('country-level, not a location');
  });
});
