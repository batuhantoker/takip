import { describe, expect, it } from 'vitest';
import { EN } from '../places/copy/format';
import { findCountry } from './countries';
import { foldName, matchCountries } from './country-search';

describe('foldName', () => {
  it('drops case, accents and punctuation, and keeps other scripts', () => {
    expect(foldName('Côte d’Ivoire')).toBe('cote d ivoire');
    expect(foldName('TÜRKİYE')).toBe('turkiye');
    expect(foldName('U.S.A.')).toBe('u s a');
    expect(foldName('Россия')).toBe('россия');
  });
});

describe('matchCountries', () => {
  const options = [
    { slug: 'australia', name: 'Australia', codes: ['au', 'aus'] },
    { slug: 'belarus', name: 'Belarus', codes: ['by', 'blr'] },
    { slug: 'germany', name: 'Germany', alt: ['almanya', 'deutschland'], codes: ['de', 'deu'] },
    { slug: 'north-korea', name: 'North Korea', codes: ['kp', 'prk'] },
    { slug: 'south-korea', name: 'South Korea', alt: ['korea'], codes: ['kr', 'kor'] },
    { slug: 'trinidad-and-tobago', name: 'Trinidad and Tobago', codes: ['tt', 'tto'] },
    { slug: 'turkey', name: 'Türkiye', also: 'Turkey', codes: ['tr', 'tur'] },
    { slug: 'united-states', name: 'United States', alt: ['america'], codes: ['us', 'usa'] },
  ];
  const slugs = (q: string) => matchCountries(options, q).map(o => o.slug);

  it('puts a code or a whole name first', () => {
    expect(slugs('US')[0]).toBe('united-states');
    expect(slugs('usa')).toEqual(['united-states']);
    expect(slugs('TR')).toEqual(['turkey', 'trinidad-and-tobago', 'australia']);
    expect(slugs('korea')).toEqual(['south-korea', 'north-korea']);
    expect(slugs('America')).toEqual(['united-states']);
  });

  it('finds a name by its start, a word’s start, or inside it, in any language it is given', () => {
    expect(slugs('turk')).toEqual(['turkey']);
    expect(slugs('turkiye')).toEqual(['turkey']);
    expect(slugs('alman')).toEqual(['germany']);
    expect(slugs('tschland')).toEqual([]);
    expect(slugs('')).toHaveLength(options.length);
    expect(slugs('atlantis')).toEqual([]);
  });

  it('forgives a slip where nothing else matches', () => {
    expect(slugs('germny')).toEqual(['germany']);
    expect(slugs('turky')).toEqual(['turkey']);
    expect(slugs('untied states')).toEqual(['united-states']);
  });
});

describe('findCountry', () => {
  it('takes a slug, a code, a name in any case or accents, or the best match', () => {
    const turkey = findCountry('turkey', EN);
    if (!turkey) return;
    expect(findCountry('Türkiye', EN)?.id).toBe(turkey.id);
    expect(findCountry('TR', EN)?.id).toBe(turkey.id);
    expect(findCountry('US', EN)?.slug).toBe('united-states');
    expect(findCountry('uk', EN)?.slug).toBe('united-kingdom');
    expect(findCountry('almanya', EN)?.slug).toBe('germany');
    expect(findCountry('germ', EN)?.slug).toBe('germany');
    expect(findCountry('  ', EN)).toBeUndefined();
  });
});
