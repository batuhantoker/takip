import { describe, expect, it } from 'vitest';
import { languageAlternates, localePath, splitLocalePath } from './locale-path';

describe('splitLocalePath', () => {
  it('reads the language off a reading page', () => {
    expect(splitLocalePath('/tr/map/earthquakes')).toEqual({ locale: 'tr', path: '/map/earthquakes' });
    expect(splitLocalePath('/ja/about')).toEqual({ locale: 'ja', path: '/about' });
    expect(splitLocalePath('/map')).toEqual({ locale: 'en', path: '/map' });
    expect(splitLocalePath('/tr/embed/earthquakes')).toEqual({ locale: 'tr', path: '/embed/earthquakes' });
    expect(splitLocalePath('/tr/city/nevsehir/cameras')).toEqual({ locale: 'tr', path: '/city/nevsehir/cameras' });
    expect(splitLocalePath('/country/turkey')).toEqual({ locale: 'en', path: '/country/turkey' });
    expect(splitLocalePath('/tr/compare/greece-vs-turkey/life-expectancy')).toEqual({ locale: 'tr', path: '/compare/greece-vs-turkey/life-expectancy' });
    expect(splitLocalePath('/compare')).toEqual({ locale: 'en', path: '/compare' });
  });

  it('leaves everything else alone', () => {
    expect(splitLocalePath('/tr/docs')).toBeNull();
    expect(splitLocalePath('/en/map')).toBeNull();
    expect(splitLocalePath('/xx/map')).toBeNull();
    expect(splitLocalePath('/')).toBeNull();
    expect(splitLocalePath('/mapping')).toBeNull();
  });
});

describe('localePath', () => {
  it('prefixes reading pages only', () => {
    expect(localePath('tr', '/map/earthquakes')).toBe('/tr/map/earthquakes');
    expect(localePath('tr', '/map#space')).toBe('/tr/map#space');
    expect(localePath('en', '/about')).toBe('/about');
    expect(localePath('tr', '/')).toBe('/');
    expect(localePath('tr', '/privacy')).toBe('/privacy');
  });
});

describe('languageAlternates', () => {
  it('names all ten languages and an English default', () => {
    const alt = languageAlternates('/about', 'https://takip.example');
    expect(Object.keys(alt)).toHaveLength(11);
    expect(alt.de).toBe('https://takip.example/de/about');
    expect(alt['x-default']).toBe('https://takip.example/about');
  });
});
