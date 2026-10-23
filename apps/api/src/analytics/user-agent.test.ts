import { describe, expect, it } from 'vitest';
import { disguisedAgent, parseUserAgent } from './user-agent';

describe('parseUserAgent', () => {
  it.each([
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', { browser: 'Chrome', os: 'macOS', device: 'desktop' }],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0', { browser: 'Edge', os: 'Windows', device: 'desktop' }],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', { browser: 'Safari', os: 'iOS', device: 'mobile' }],
    ['Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1', { browser: 'Chrome', os: 'iOS', device: 'tablet' }],
    ['Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36', { browser: 'Chrome', os: 'Android', device: 'mobile' }],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0', { browser: 'Firefox', os: 'Linux', device: 'desktop' }],
    ['curl/8.7.1', { browser: 'Other', os: 'Other', device: 'desktop' }],
    [null, { browser: 'Other', os: 'Other', device: 'desktop' }],
  ])('%s', (ua, expected) => {
    expect(parseUserAgent(ua)).toEqual(expected);
  });
});

describe('disguisedAgent', () => {
  const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
  const BRANDS = '"Google Chrome";v="141", "Chromium";v="141", "Not)A;Brand";v="8"';

  it('trusts a browser whose hints agree with its user agent, or that sends none', () => {
    expect(disguisedAgent(WINDOWS, BRANDS, '"Windows"')).toBe(false);
    expect(disguisedAgent('Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', BRANDS, '"Chrome OS"')).toBe(false);
    expect(disguisedAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', BRANDS, '"Android"')).toBe(false);
    expect(disguisedAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', undefined, undefined)).toBe(false);
  });

  it('catches a Chromium whose hints name another system or version', () => {
    expect(disguisedAgent(WINDOWS, BRANDS, '"Linux"')).toBe(true);
    expect(disguisedAgent(WINDOWS, '"Google Chrome";v="155", "Chromium";v="155"', '"Windows"')).toBe(true);
  });
});
