import { describe, expect, it } from 'vitest';
import { knownCountryCodes } from '@/app/api/(intel)/advisories/country-codes';
import { aggregateOutbreaks } from './aggregate';
import { centroidFor } from '@/lib/places/country-centroids';
import type { OutbreakNotice } from './types';

const NOW = Date.parse('2026-10-12T20:00:00Z');

const notice = (over: Partial<OutbreakNotice>): OutbreakNotice => ({
  source: 'CDC',
  title: 't',
  url: 'https://example.test',
  published: '2026-09-01T00:00:00.000Z',
  disease: 'Ebola',
  countries: [{ iso2: 'CD', name: 'Democratic Republic of the Congo' }],
  unmatched: [],
  level: null,
  ...over,
});

describe('aggregateOutbreaks', () => {
  it('pins each country at its centroid', () => {
    const { outbreaks } = aggregateOutbreaks([notice({
      countries: [{ iso2: 'CD', name: 'Democratic Republic of the Congo' }, { iso2: 'UG', name: 'Uganda' }],
      level: 2,
      title: 'Level 2 - Ebola Bundibugyo Virus Disease in the Democratic Republic of the Congo and Uganda',
    })], NOW);
    expect(outbreaks).toEqual([
      {
        id: 'cdc-ebola-cd', disease: 'Ebola', country: 'Democratic Republic of the Congo', iso2: 'CD', lat: -3, lng: 24,
        precision: 'country', title: 'Level 2 - Ebola Bundibugyo Virus Disease in the Democratic Republic of the Congo and Uganda',
        url: 'https://example.test', published: '2026-09-01T00:00:00.000Z', source: 'CDC', level: 2,
      },
      expect.objectContaining({ id: 'cdc-ebola-ug', iso2: 'UG', lat: 1.4, lng: 32.4 }),
    ]);
  });

  it('drops WHO and ECDC items over 90 days old, and any item without a date or a known disease', () => {
    const { outbreaks, unmatched } = aggregateOutbreaks([
      notice({ source: 'WHO', published: '2026-07-13T00:00:00.000Z', title: 'old', unmatched: ['Wake Island'] }),
      notice({ published: null, title: 'undated' }),
      notice({ disease: null, title: 'no disease' }),
      notice({ source: 'WHO', published: '2026-07-15T00:00:00.000Z', title: 'fresh' }),
    ], NOW);
    expect(outbreaks.map(o => o.title)).toEqual(['fresh']);
    expect(unmatched).toEqual([]);
  });

  it('lists a notice naming more than 50 countries as worldwide instead of pinning every country', () => {
    const countries = Array.from({ length: 51 }, (_, i) => ({ iso2: `X${i}`, name: `Country ${i}` }));
    const { outbreaks, worldwide } = aggregateOutbreaks([notice({ disease: 'Measles', title: 'Global Measles', countries })], NOW);
    expect(outbreaks).toEqual([]);
    expect(worldwide).toEqual([{ source: 'CDC', title: 'Global Measles', url: 'https://example.test', published: '2026-09-01T00:00:00.000Z', countries: 51 }]);
  });

  it('keeps an old CDC notice: CDC lists it only while it is in force', () => {
    const { outbreaks } = aggregateOutbreaks([notice({ published: '2025-05-01T00:00:00.000Z', disease: 'Measles', title: 'Global Measles' })], NOW);
    expect(outbreaks.map(o => o.title)).toEqual(['Global Measles']);
  });

  it('keeps the newest item per source × disease × country when there is no level', () => {
    const { outbreaks } = aggregateOutbreaks([
      notice({ source: 'WHO', published: '2026-09-25T15:16:26.000Z', title: 'DON618' }),
      notice({ source: 'WHO', published: '2026-10-08T15:16:26.000Z', title: 'DON619' }),
      notice({ source: 'ECDC', published: '2026-10-12T15:36:21.000Z', title: 'ECDC' }),
    ], NOW);
    expect(outbreaks.map(o => [o.id, o.title])).toEqual([['ecdc-ebola-cd', 'ECDC'], ['who-ebola-cd', 'DON619']]);
  });

  it('lets the higher CDC level win over a newer, lower notice for the same outbreak', () => {
    const { outbreaks } = aggregateOutbreaks([
      notice({ level: 2, published: '2026-08-28T04:00:00.000Z', title: 'Level 2 - DRC and Uganda' }),
      notice({ level: 4, published: '2026-08-04T04:00:00.000Z', title: 'Level 4 - Ituri and Nord-Kivu' }),
      notice({ level: 3, published: '2026-08-04T04:00:00.000Z', title: 'Level 3 - Haut-Uélé and Tshopo' }),
    ], NOW);
    expect(outbreaks.map(o => [o.level, o.title])).toEqual([[4, 'Level 4 - Ituri and Nord-Kivu']]);
  });

  it('reports unmatched names from items that passed the filters', () => {
    expect(aggregateOutbreaks([notice({ unmatched: ['Narnia'] })], NOW).unmatched).toEqual(['Narnia']);
  });
});

describe('centroidFor', () => {
  it('has a point for every country a name can resolve to, except the scattered U.S. Outlying Islands', () => {
    expect([...knownCountryCodes()].filter(c => !centroidFor(c))).toEqual(['UM']);
  });
});
