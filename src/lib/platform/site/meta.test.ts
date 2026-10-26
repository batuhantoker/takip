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
