import { createVerify, generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminKit } from '../admin/testing';
import { startApp, type TestApp } from '../testing/helpers';
import { alpha2, createSearchConsole, type SearchConsole, type SearchQuery, type SearchRow } from './search-console';
import { rangeOf } from './range';
import { pageType, searchReport } from './search-report';

const NOW = Date.UTC(2026, 9, 21, 12);
const RANGE = rangeOf({ days: 7, admins: 'include' }, NOW);

describe('page types', () => {
  it('adds pages up by what TAKIP generates, in any language', () => {
    expect(pageType('https://takip.dev/tr/city/istanbul/prayer-times')).toEqual({ type: 'City · prayer times', locale: 'tr', path: '/city/istanbul/prayer-times' });
    expect(['https://takip.dev/', 'https://takip.dev/city/berlin', 'https://takip.dev/country/turkey/population-growth', 'https://takip.dev/map/flight-tracker',
      'https://takip.dev/event/1906-san-francisco-earthquake', 'https://takip.dev/compare/greece-vs-turkey/inflation', 'https://takip.dev/guides', 'https://takip.dev/ramadan']
      .map(u => pageType(u).type)).toEqual(['The map (home)', 'City overview', 'Country · population growth', 'Map layer pages', 'Events', 'Compare · one measure', 'Guides index', '/ramadan']);
  });

  it('turns Search Console countries into two-letter codes', () => {
    expect([alpha2('tur'), alpha2('usa'), alpha2('deu'), alpha2('zzz')]).toEqual(['TR', 'US', 'DE', null]);
  });
});

describe('the Search Console client', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  const keyFile = join(mkdtempSync(join(tmpdir(), 'gsc-')), 'key.json');
  writeFileSync(keyFile, JSON.stringify({ type: 'service_account', client_email: 'reader@takip.iam.gserviceaccount.com', private_key: privateKey }));

  it('signs in with a signed token, finds the property and asks for fresh numbers', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fake = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.includes('oauth2')) return Response.json({ access_token: 'tok', expires_in: 3600 });
      if (url.endsWith('/sites')) return Response.json({ siteEntry: [{ siteUrl: 'https://other.example/' }, { siteUrl: 'sc-domain:takip.dev' }] });
      return Response.json({ rows: [{ keys: ['2026-10-20'], clicks: 3, impressions: 40, ctr: 0.075, position: 8.2 }] });
    }) as typeof fetch;
    const gsc = createSearchConsole({ credentialsPath: keyFile, host: 'takip.dev', fetch: fake, now: () => NOW })!;

    expect(gsc.account).toBe('reader@takip.iam.gserviceaccount.com');
    expect(await gsc.query({ startDate: '2026-10-15', endDate: '2026-10-21', dimensions: ['date'] })).toHaveLength(1);
    await gsc.query({ startDate: '2026-10-15', endDate: '2026-10-21', dimensions: ['page'] });

    const assertion = new URLSearchParams(String(calls[0].init?.body)).get('assertion')!;
    const [header, claims, signature] = assertion.split('.');
    expect(createVerify('RSA-SHA256').update(`${header}.${claims}`).verify(publicKey, signature, 'base64url')).toBe(true);
    expect(JSON.parse(Buffer.from(claims, 'base64url').toString())).toMatchObject({ iss: 'reader@takip.iam.gserviceaccount.com', scope: 'https://www.googleapis.com/auth/webmasters.readonly' });

    expect(calls.filter(c => c.url.includes('oauth2'))).toHaveLength(1);
    const asked = calls.find(c => c.url.includes('searchAnalytics'))!;
    expect(asked.url).toContain(encodeURIComponent('sc-domain:takip.dev'));
    expect(JSON.parse(String(asked.init?.body))).toMatchObject({ dataState: 'all', dimensions: ['date'] });
    expect((asked.init?.headers as Record<string, string>).authorization).toBe('Bearer tok');
  });

  it('is off without a key', () => {
    expect(createSearchConsole({})).toBeNull();
  });
});

describe('the search report', () => {
  const row = (keys: string[], clicks: number, impressions: number, position: number): SearchRow => ({ keys, clicks, impressions, ctr: clicks / impressions, position });
  const fake = (rows: Partial<Record<string, SearchRow[]>>, site: string | null = 'sc-domain:takip.dev'): SearchConsole => ({
    account: 'reader@takip.iam.gserviceaccount.com',
    site: async () => site,
    query: async (q: SearchQuery) => rows[q.dimensions.join(',')] ?? [],
  });

  it('adds up pages by type and language, with the searches that showed each type', async () => {
    const report = await searchReport(fake({
      date: [row(['2026-10-20'], 3, 100, 10)],
      page: [
        row(['https://takip.dev/city/berlin/weather'], 2, 60, 6),
        row(['https://takip.dev/tr/city/istanbul/weather'], 1, 20, 12),
        row(['https://takip.dev/map/flight-tracker'], 0, 20, 30),
      ],
      'page,query': [row(['https://takip.dev/city/berlin/weather', 'berlin weather'], 2, 50, 6), row(['https://takip.dev/tr/city/istanbul/weather', 'istanbul hava'], 1, 20, 12)],
      query: [row(['berlin weather'], 2, 50, 6)],
      country: [row(['deu'], 2, 60, 6), row(['zzz'], 0, 5, 40)],
      device: [row(['MOBILE'], 3, 100, 10)],
    }), RANGE, NOW);
    expect(report).toMatchObject({ configured: true, site: 'sc-domain:takip.dev', error: null, truncated: false, totals: { clicks: 3, impressions: 100, pages: 3, position: 12 } });
    if (!('types' in report)) throw new Error('no report');
    expect(report.types).toEqual([
      { type: 'City · weather', pages: 2, clicks: 3, impressions: 80, ctr: 3 / 80, position: 7.5 },
      { type: 'Map layer pages', pages: 1, clicks: 0, impressions: 20, ctr: 0, position: 30 },
    ]);
    expect(report.languages.map(l => [l.locale, l.impressions])).toEqual([['en', 80], ['tr', 20]]);
    expect(report.typeQueries.map(q => q.query)).toEqual(['berlin weather', 'istanbul hava']);
    expect(report.pages[0]).toMatchObject({ path: '/city/berlin/weather', type: 'City · weather' });
    expect(report.countries.map(c => c.country)).toEqual(['DE', null]);
    expect(report.daily.at(-2)).toEqual({ day: '2026-10-20', clicks: 3, impressions: 100, position: 10 });
  });

  it('says when it is off, when the account reads no property, and what went wrong', async () => {
    expect(await searchReport(null, RANGE, NOW)).toEqual({ configured: false });
    expect(await searchReport(fake({}, null), RANGE, NOW)).toMatchObject({ configured: true, site: null, error: null });
    const broken: SearchConsole = { account: 'x', site: async () => { throw new Error('Google sign-in failed: invalid_grant'); }, query: async () => [] };
    expect(await searchReport(broken, RANGE, NOW)).toMatchObject({ configured: true, error: 'Google sign-in failed: invalid_grant' });
  });
});

describe('the search tab', () => {
  let t: TestApp;
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    t = await startApp();
  });
  afterEach(() => {
    vi.useRealTimers();
    t.close();
  });

  it('answers that Search Console isn’t set up when no key is', async () => {
    const kit = adminKit(t);
    const root = await kit.admin();
    const res = await kit.call(root.jar, 'GET', '/api/admin/analytics/search?days=30');
    expect(res.status).toBe(200);
    expect(await kit.json(res)).toEqual({ configured: false });
  });
});
