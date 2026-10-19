import { describe, expect, it } from 'vitest';
import { browserLanguages, edgeCountry, pickLocale } from './pick-locale';

describe('browserLanguages', () => {
  it('orders by quality and keeps base codes once', () => {
    expect(browserLanguages('de-CH,fr;q=0.8,de;q=0.9,en-US;q=0.5,*;q=0.1')).toEqual(['de', 'fr', 'en']);
  });

  it('drops q=0 and junk', () => {
    expect(browserLanguages('tr;q=0, ,en')).toEqual(['en']);
    expect(browserLanguages(null)).toEqual([]);
  });

  it('reads Traditional Chinese, and a bare zh after it, as zh-hant', () => {
    expect(browserLanguages('zh-TW,zh;q=0.9,en;q=0.8')).toEqual(['zh-hant', 'en']);
    expect(browserLanguages('zh-Hant-HK,en')).toEqual(['zh-hant', 'en']);
    expect(browserLanguages('zh-CN,zh;q=0.9')).toEqual(['zh']);
  });
});

describe('edgeCountry', () => {
  const h = (entries: Record<string, string>) => new Headers(entries);

  it('reads Cloudflare, then Vercel', () => {
    expect(edgeCountry(h({ 'cf-ipcountry': 'TR' }))).toBe('TR');
    expect(edgeCountry(h({ 'x-vercel-ip-country': 'de' }))).toBe('DE');
  });

  it('ignores unknown and Tor', () => {
    expect(edgeCountry(h({ 'cf-ipcountry': 'XX' }))).toBeNull();
    expect(edgeCountry(h({ 'cf-ipcountry': 'T1' }))).toBeNull();
    expect(edgeCountry(h({}))).toBeNull();
  });
});

describe('pickLocale', () => {
  it('keeps an explicit pick over everything', () => {
    expect(pickLocale({ saved: 'ja', country: 'TR', acceptLanguage: 'tr' })).toBe('ja');
    expect(pickLocale({ saved: 'xx', country: 'TR' })).toBe('tr');
  });

  it("uses the country's language over the browser's", () => {
    expect(pickLocale({ country: 'TR', acceptLanguage: 'de-DE,de' })).toBe('tr');
    expect(pickLocale({ country: 'BR', acceptLanguage: 'en-US' })).toBe('pt');
  });

  it("lets the browser choose among a multilingual country's languages", () => {
    expect(pickLocale({ country: 'CH', acceptLanguage: 'fr-CH,fr' })).toBe('fr');
    expect(pickLocale({ country: 'CH', acceptLanguage: 'en' })).toBe('de');
    expect(pickLocale({ country: 'CA', acceptLanguage: 'fr-CA' })).toBe('fr');
    expect(pickLocale({ country: 'CA', acceptLanguage: 'es' })).toBe('en');
  });

  it("doesn't hand a country a minority language when its own isn't shipped", () => {
    expect(pickLocale({ country: 'IL', acceptLanguage: 'he-IL,he;q=0.9,en;q=0.8' })).toBe('en');
    expect(pickLocale({ country: 'IL', acceptLanguage: 'ar' })).toBe('ar');
    expect(pickLocale({ country: 'IN', acceptLanguage: 'hi-IN,hi;q=0.9,en;q=0.8' })).toBe('en');
    expect(pickLocale({ country: 'BE', acceptLanguage: 'nl-BE,nl' })).toBe('en');
    expect(pickLocale({ country: 'BE', acceptLanguage: 'fr-BE,fr' })).toBe('fr');
    expect(pickLocale({ country: 'UA', acceptLanguage: 'uk' })).toBe('en');
  });

  it('keeps Traditional Chinese readers off Simplified', () => {
    expect(pickLocale({ country: 'TW', acceptLanguage: 'zh-TW,zh;q=0.9,en;q=0.8' })).toBe('en');
    expect(pickLocale({ country: 'HK', acceptLanguage: 'zh-HK' })).toBe('en');
    expect(pickLocale({ country: 'CN' })).toBe('zh');
  });

  it('falls back to the browser, then English', () => {
    expect(pickLocale({ acceptLanguage: 'ja,en;q=0.5' })).toBe('ja');
    expect(pickLocale({ country: 'NL', acceptLanguage: 'nl,de;q=0.7' })).toBe('de');
    expect(pickLocale({ country: 'ZZ' })).toBe('en');
    expect(pickLocale({})).toBe('en');
  });
});
