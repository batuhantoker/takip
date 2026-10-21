import { describe, expect, it } from 'vitest';
import { languageRedirect } from './language-redirect';

const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const PAGE = '/city/istanbul/prayer-times';

/** A person following a search result: a document request from another site. */
const arrival = (extra: Record<string, string>) => new Headers({
  'user-agent': CHROME, 'sec-fetch-dest': 'document', 'sec-fetch-site': 'cross-site', referer: 'https://www.google.com/', host: 'takip.dev', ...extra,
});

describe('language redirect for English reading pages', () => {
  it('sends Spain and Latin America to Spanish, keeping the query', () => {
    expect(languageRedirect(PAGE, '', arrival({ 'cf-ipcountry': 'ES', 'accept-language': 'es-ES,es;q=0.9' }), undefined)).toBe(`/es${PAGE}`);
    expect(languageRedirect(PAGE, '?d=2026-10-21', arrival({ 'cf-ipcountry': 'MX' }), undefined)).toBe(`/es${PAGE}?d=2026-10-21`);
    expect(languageRedirect('/map/earthquakes', '', arrival({ 'cf-ipcountry': 'BR' }), undefined)).toBe('/pt/map/earthquakes');
  });

  it('leaves the Netherlands and Belgium in English unless the browser asks for one of ours', () => {
    expect(languageRedirect(PAGE, '', arrival({ 'cf-ipcountry': 'NL', 'accept-language': 'nl-NL,nl;q=0.9,en;q=0.8' }), undefined)).toBeNull();
    expect(languageRedirect(PAGE, '', arrival({ 'cf-ipcountry': 'BE', 'accept-language': 'nl-BE,nl' }), undefined)).toBeNull();
    expect(languageRedirect(PAGE, '', arrival({ 'cf-ipcountry': 'BE', 'accept-language': 'fr-BE,fr' }), undefined)).toBe(`/fr${PAGE}`);
  });

  it('follows a language the visitor picked over their country', () => {
    expect(languageRedirect(PAGE, '', arrival({ 'cf-ipcountry': 'ES' }), 'en')).toBeNull();
    expect(languageRedirect(PAGE, '', arrival({ 'cf-ipcountry': 'US' }), 'tr')).toBe(`/tr${PAGE}`);
  });

  it('never moves crawlers, link previews, prefetches or clicks within the site', () => {
    const spain = { 'cf-ipcountry': 'ES' };
    expect(languageRedirect(PAGE, '', arrival({ ...spain, 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }), undefined)).toBeNull();
    expect(languageRedirect(PAGE, '', arrival({ ...spain, 'user-agent': 'facebookexternalhit/1.1' }), undefined)).toBeNull();
    expect(languageRedirect(PAGE, '', arrival({ ...spain, 'user-agent': 'Mediapartners-Google' }), undefined)).toBeNull();
    expect(languageRedirect(PAGE, '', arrival({ ...spain, 'user-agent': 'Mozilla/5.0 (compatible; Google-InspectionTool/1.0;)' }), undefined)).toBeNull();
    expect(languageRedirect(PAGE, '', arrival({ ...spain, 'sec-fetch-site': 'same-origin', referer: 'https://takip.dev/es/city/istanbul' }), undefined)).toBeNull();
    expect(languageRedirect(PAGE, '', arrival({ ...spain, 'sec-fetch-dest': 'empty' }), undefined)).toBeNull();
    expect(languageRedirect(PAGE, '', arrival({ ...spain, rsc: '1' }), undefined)).toBeNull();
    // An older browser without Sec-Fetch headers, coming from a page on the site.
    const old = new Headers({ 'user-agent': CHROME, 'cf-ipcountry': 'ES', referer: 'https://takip.dev/es/map', host: 'takip.dev' });
    expect(languageRedirect(PAGE, '', old, undefined)).toBeNull();
  });

  it('leaves embeds alone, and an English reader where they are', () => {
    expect(languageRedirect('/embed/earthquakes', '', arrival({ 'cf-ipcountry': 'ES' }), undefined)).toBeNull();
    expect(languageRedirect(PAGE, '', arrival({ 'cf-ipcountry': 'GB' }), undefined)).toBeNull();
  });
});
