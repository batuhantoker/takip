import { describe, expect, it } from 'vitest';
import { appAuthLink, appLinkPath, appProviders, appSignInUrl, handoffPath, safeReturn } from './handoff';

const ORIGIN = 'https://takip.dev';

describe('safeReturn', () => {
  it('keeps a path on this site', () => {
    expect(safeReturn('/?layers=ships')).toBe('/?layers=ships');
    expect(safeReturn('/tr/map/earthquakes')).toBe('/tr/map/earthquakes');
  });

  it('sends anything else back to the map', () => {
    for (const raw of [null, undefined, '', 'https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/\t/evil.example', '/\n/evil.example', '/a\\b']) {
      expect(safeReturn(raw)).toBe('/');
    }
  });
});

describe('the sign-in round trip', () => {
  it('carries the provider, the return path and the state through each step', () => {
    const start = new URL(appSignInUrl(ORIGIN, 'google', '/?layers=ships', 'abc'));
    expect(`${start.origin}${start.pathname}`).toBe(`${ORIGIN}/app/sign-in`);
    expect(Object.fromEntries(start.searchParams)).toEqual({ provider: 'google', return: '/?layers=ships', state: 'abc' });

    expect(handoffPath('/?layers=ships', 'abc')).toBe('/app/handoff?return=%2F%3Flayers%3Dships&state=abc');

    const back = appAuthLink({ ott: 'tok' }, '/?layers=ships', 'abc');
    expect(back).toBe('dev.takip.app://auth?ott=tok&return=%2F%3Flayers%3Dships&state=abc');
    expect(appLinkPath(back, ORIGIN)).toBe('/app/verify?ott=tok&return=%2F%3Flayers%3Dships&state=abc');
  });

  it('never carries a return path off the site', () => {
    expect(new URL(appSignInUrl(ORIGIN, 'github', '//evil.example', 's')).searchParams.get('return')).toBe('/');
    expect(appAuthLink({ error: 'access_denied' }, 'https://evil.example', 's')).toBe('dev.takip.app://auth?error=access_denied&return=%2F&state=s');
  });
});

describe('appLinkPath', () => {
  it('opens a link to this site at its own path', () => {
    expect(appLinkPath('https://takip.dev/city/istanbul/weather?x=1#top', ORIGIN)).toBe('/city/istanbul/weather?x=1#top');
  });

  it('opens the page a widget tap names, and only on this site', () => {
    expect(appLinkPath('dev.takip.app://open?path=%2F%3Flat%3D41%26layers%3Dearthquakes', ORIGIN)).toBe('/?lat=41&layers=earthquakes');
    expect(appLinkPath('dev.takip.app://open?path=%2F%2Fevil.example', ORIGIN)).toBe('/');
    expect(appLinkPath('dev.takip.app://open', ORIGIN)).toBe('/');
  });

  it('ignores links it has no page for', () => {
    for (const link of ['https://elsewhere.example/', 'dev.takip.app://settings', 'not a url', 'http://takip.dev/']) {
      expect(appLinkPath(link, ORIGIN)).toBeNull();
    }
  });
});

describe('appProviders', () => {
  const ios = { platform: 'ios' as const, version: '1.0.0' };
  it('offers an iPhone email only until Sign in with Apple is set up', () => {
    expect(appProviders(ios, ['google', 'github'])).toEqual([]);
    expect(appProviders(ios, ['google', 'apple'])).toEqual(['google', 'apple']);
  });

  it('leaves every other app and the browser alone', () => {
    expect(appProviders({ platform: 'android', version: '1.0.0' }, ['google', 'github'])).toEqual(['google', 'github']);
    expect(appProviders(null, ['google'])).toEqual(['google']);
  });
});
