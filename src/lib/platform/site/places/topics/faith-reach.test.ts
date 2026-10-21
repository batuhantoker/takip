import { describe, expect, it } from 'vitest';
import { placeBySlug } from '../gazetteer';
import { findPlacePage } from '../pages';
import { faithPages, faithShown, topicShown } from './faith-reach';
import { shabbatCities } from './shabbat';

const city = (slug: string) => placeBySlug('city', slug)!;

describe('faith pages', () => {
  it('give prayer times and Ramadan where Muslims live in numbers, and not elsewhere', () => {
    for (const slug of ['istanbul', 'london', 'paris', 'new-york-city', 'urumqi']) expect(faithPages(city(slug)), slug).toContain('muslim');
    for (const slug of ['ho-chi-minh-city', 'tokyo', 'mexico-city']) expect(faithPages(city(slug)), slug).not.toContain('muslim');
  });

  it('give Shabbat times in Israel and the large Jewish communities, Istanbul’s among them', () => {
    for (const slug of ['jerusalem', 'tel-aviv', 'london', 'istanbul', 'buenos-aires', 'antwerp']) expect(faithPages(city(slug)), slug).toContain('jewish');
    expect(faithPages(city('tokyo'))).not.toContain('jewish');
  });

  it('show on a city’s own pages only its country’s majority faith', () => {
    expect(faithShown(city('istanbul'))).toEqual(['muslim']);
    expect(faithShown(city('jerusalem'))).toEqual(['jewish']);
    expect(faithShown(city('london'))).toEqual([]);
    expect([topicShown(city('istanbul'), 'ramadan'), topicShown(city('jerusalem'), 'prayer'), topicShown(city('jerusalem'), 'shabbat')]).toEqual([true, false, true]);
  });

  it('keep a minority faith’s pages, indexed, without a Prayers page to lead to them', () => {
    expect(findPlacePage(city('istanbul'), 'shabbat-times')?.page.index).toBe(true);
    expect(findPlacePage(city('london'), 'prayer-times')?.page.index).toBe(true);
    expect(findPlacePage(city('london'), 'prayers')).toBeUndefined();
    expect(findPlacePage(city('istanbul'), 'prayers')?.page.index).toBe(false);
    expect(findPlacePage(city('ho-chi-minh-city'), 'prayer-times')).toBeUndefined();
  });

  it('list the cities with Shabbat pages for the Jewish holidays page', () => {
    const list = shabbatCities();
    expect(list.find(c => c.place.slug === 'istanbul')).toMatchObject({ slug: 'shabbat-times', index: true });
    expect(list.some(c => c.place.slug === 'jerusalem')).toBe(true);
  });
});
