import { describe, expect, it } from 'vitest';
import { crawlRel, readingMetadata, unindexed } from './meta';

describe('unindexed', () => {
  it('keeps the canonical and drops the other languages', () => {
    const meta = unindexed(readingMetadata({ locale: 'tr', path: '/city/alabel', title: 'Alabel', description: '', image: '/og' }));
    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(meta.alternates).toEqual({ canonical: '/tr/city/alabel' });
    expect(meta.title).toBe('Alabel');
  });
});

describe('crawlRel', () => {
  it('sends crawlers only to indexed pages', () => {
    expect(crawlRel(true)).toBeUndefined();
    expect(crawlRel(false)).toBe('nofollow');
  });
});

describe('readingMetadata and the search scope', () => {
  const meta = (locale: 'en' | 'tr', path: string) => readingMetadata({ locale, path, title: 't', description: '', image: '/og' });

  it('indexes the /map pages in every language, each naming the others', () => {
    for (const locale of ['en', 'tr'] as const) {
      expect(meta(locale, '/map/earthquakes').robots).toBeUndefined();
      expect(meta(locale, '/map/earthquakes').alternates?.languages).toMatchObject({ en: '/map/earthquakes', tr: '/tr/map/earthquakes' });
    }
  });

  it('indexes the place pages in English only, with no alternates', () => {
    expect(meta('en', '/city/heerlen/cameras').robots).toBeUndefined();
    expect(meta('en', '/city/heerlen/cameras').alternates).toEqual({ canonical: '/city/heerlen/cameras' });
    expect(meta('tr', '/city/heerlen/cameras').robots).toEqual({ index: false, follow: true });
  });

  it('keeps the comparisons, events, mountains and US areas out in every language', () => {
    for (const path of ['/compare', '/compare/france-vs-spain', '/event/1999-izmit-earthquake', '/mountain/ararat', '/mountains', '/county', '/state/georgia']) {
      expect(meta('en', path).robots).toEqual({ index: false, follow: true });
    }
  });
});
