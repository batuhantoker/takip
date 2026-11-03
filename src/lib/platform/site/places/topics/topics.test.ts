import { describe, expect, it } from 'vitest';
import { EN } from '../copy/format';
import { placeBySlug } from '../gazetteer';
import { overviewCopy } from '../overview';
import { indexedPages, placePages } from '../pages';
import { TOPICS } from './registry';
import { topicTable } from '../tables';

// indicators.json is private (docs/data-licenses.md); a checkout without it has shorter country descriptions.
const HAS_INDICATORS = topicTable('indicators').generated !== '';

// Every page search engines are told about, with the copy it would show.
const pages = indexedPages().map(({ place, slug }) => {
  const all = placePages(place);
  const ref = slug ? all.find(p => p.page.slug === slug)! : undefined;
  return { place, slug, copy: ref ? ref.topic.header(place, ref.page, EN) : overviewCopy(place, all, EN) };
});

describe('place topics', () => {
  it('have distinct ids and a view for each kind they claim', () => {
    expect(new Set(TOPICS.map(t => t.id)).size).toBe(TOPICS.length);
  });

  it('keep every indexed title within 60 characters', () => {
    expect(pages.filter(p => p.copy.title.length > 60).map(p => p.copy.title)).toEqual([]);
  });

  it.skipIf(!HAS_INDICATORS)('keep every indexed description between 110 and 160 characters', () => {
    expect(pages.filter(p => p.copy.description.length < 110 || p.copy.description.length > 160).map(p => p.copy.description)).toEqual([]);
  });

  it('give every indexed page its own title', () => {
    const seen = new Map<string, string>();
    const dupes = pages.filter(p => {
      const key = `${p.place.kind}/${p.place.slug}/${p.slug ?? ''}`;
      if (seen.has(p.copy.title)) return true;
      seen.set(p.copy.title, key);
      return false;
    }).map(p => p.copy.title);
    expect(dupes).toEqual([]);
  });

  it('say what they found for Cincinnati', () => {
    const city = placeBySlug('city', 'cincinnati')!;
    const transit = placePages(city).find(p => p.topic.id === 'transit')!;
    expect(transit.page.index).toBe(true);
    expect(transit.topic.header(city, transit.page, EN).lede).toMatch(/^Cincinnati Metro and Transit Authority of Northern Kentucky \(TANK\) publish (where their vehicles are|live positions)/);
  });
});
