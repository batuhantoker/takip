import { describe, expect, it } from 'vitest';
import { createTranslator } from '@/lib/core/i18n/translator';
import { EN } from '../copy/format';
import { placeBySlug } from '../gazetteer';
import { HUB_SLUG, INDICATOR_TOPIC } from './indicators';
import { indicatorSpec, type IndicatorFacts, type IndicatorSeries } from './indicators-data';
import { formatNumber, formatValue, indicatorIndexed, indicatorSentences, projectionName } from './indicators-facts';
import { indicatorSeries } from './indicators-table';

const facts = (f: Partial<IndicatorFacts> = {}): IndicatorFacts => ({ n: 74, first: [1950, 47.29], last: [2023, 77.16], max: [2019, 77.74], min: [1950, 47.29], ...f });
const series = (f: Partial<IndicatorFacts> = {}): IndicatorSeries => ({ e: [1950, [47.29]], f: facts(f) });
const LE = indicatorSpec('life-expectancy')!;

describe('indicatorIndexed', () => {
  it('wants ten points, a recent latest one, and more than one value', () => {
    expect(indicatorIndexed(facts(), 2026)).toBe(true);
    expect(indicatorIndexed(facts({ n: 9 }), 2026)).toBe(false);
    expect(indicatorIndexed(facts({ last: [2010, 70] }), 2026)).toBe(false);
    expect(indicatorIndexed(facts({ max: [2000, 0], min: [1950, 0] }), 2026)).toBe(false);
  });
});

describe('formatNumber and formatValue', () => {
  it('reads each style in the reader’s language', () => {
    expect(formatValue(LE, 77.16, EN)).toBe('77.2 years');
    expect(formatNumber(87_270_000, 'count', 0, EN)).toBe('87.3 million');
    expect(formatNumber(512_000, 'count', 0, EN)).toBe('512,000');
    expect(formatNumber(15_880, 'usd', 0, EN)).toBe('$15,880');
    expect(formatNumber(30_000_000_000, 'usd', 0, EN)).toBe('$30B');
    expect(formatNumber(77.16, 'number', 1, createTranslator('de', {}))).toBe('77,2');
  });
});

describe('indicatorSentences', () => {
  it('names the estimates and the projection, its range lower to higher, as the publisher calls them', () => {
    const [span, proj] = indicatorSentences(LE, series({ proj: [2100, 88.6, 95.87, 81.64] }), undefined, 'Türkiye', EN);
    expect(span).toBe('Life expectancy in Türkiye: 47.3 years in 1950 and 77.2 years in 2023, by UN estimates.');
    expect(proj).toBe('The UN projection (medium variant) puts it at 88.6 years in 2100, between 81.6 years and 95.9 years (95% prediction interval).');
    expect(projectionName(LE.projection!, EN)).toBe('UN projection (medium variant)');
  });

  it('says a climate model’s run is modelled and ERA5 observed', () => {
    const hot = indicatorSpec('hot-days')!;
    expect(indicatorSentences(hot, series({ first: [1950, 6.3], last: [2014, 10.7] }), undefined, 'Türkiye', EN)[0])
      .toBe('Days above 35 °C in Türkiye: 6.3 days in 1950 and 10.7 days in 2014, in the CMIP6 climate models’ median run.');
    expect(indicatorSentences(indicatorSpec('temperature')!, series({ first: [1950, 10.5], last: [2025, 13] }), undefined, 'Türkiye', EN)[0])
      .toMatch(/by ERA5 observations\.$/);
  });

  it('gives a rank only where the place is the country’s alone, and the World beside it', () => {
    const meta = { rankYear: 2023, source: '', licence: '' };
    const said = (rank: IndicatorFacts['rank']) => indicatorSentences(LE, series({ rank, world: 73.17 }), meta, 'Türkiye', EN).join(' ');
    expect(said([87, 229])).toContain('In 2023, Türkiye ranked 87 of 229 countries, counting from the highest. The world as a whole: 73.2 years in 2023.');
    expect(said([1, 229])).toContain('In 2023, Türkiye had the highest value of 229 countries.');
    expect(said([49, 198, 150])).not.toContain('ranked');
  });

  it('leaves out the extremes when they are the first and latest values', () => {
    expect(indicatorSentences(LE, series({ max: [2023, 77.16] }), undefined, 'Türkiye', EN).join(' ')).not.toContain('highest');
  });
});

describe('the statistics topic', () => {
  const turkey = placeBySlug('country', 'turkey')!;
  const pages = INDICATOR_TOPIC.pages(turkey);

  it('lists the hub and keeps each measure out of the nav, opening History on it with the country charted', () => {
    if (!pages.length) return;
    expect(pages[0]).toMatchObject({ slug: HUB_SLUG });
    expect(pages[0].listed).toBeUndefined();
    const le = pages.find(p => p.slug === 'life-expectancy')!;
    expect(le.listed).toBe(false);
    expect(INDICATOR_TOPIC.open(turkey, le).mode).toMatchObject({ view: 'history', metric: 'wpp:LEx', countries: ['TUR'], range: { from: 1950 } });
  });

  it('reads a country’s series by GeoNames id or ISO2 alike', () => {
    if (!pages.length) return;
    expect(indicatorSeries('population', 'tr')?.series).toBe(indicatorSeries('population', turkey.id)?.series);
    expect(indicatorSeries('no-such-measure', 'TR')).toBeUndefined();
  });
});
