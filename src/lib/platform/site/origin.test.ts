import { describe, expect, it } from 'vitest';
import { configuredOrigin, publicOrigin } from './origin';

const h = (map: Record<string, string>) => ({ get: (k: string) => map[k.toLowerCase()] ?? null });

describe('publicOrigin', () => {
  it('prefers SITE_URL, without a trailing slash', () => {
    expect(publicOrigin(h({ host: 'evil.test' }), { SITE_URL: 'https://takip.app/' })).toBe('https://takip.app');
  });

  it('ignores a SITE_URL that is not a bare origin', () => {
    expect(configuredOrigin({ SITE_URL: 'https://takip.app/map' })).toBeNull();
    expect(configuredOrigin({ SITE_URL: 'javascript:alert(1)' })).toBeNull();
  });

  it('uses the forwarded host and protocol, as the tunnel sends them', () => {
    expect(publicOrigin(h({ 'x-forwarded-host': 'four-words.trycloudflare.com', 'x-forwarded-proto': 'https', host: '127.0.0.1:3000' }), {}))
      .toBe('https://four-words.trycloudflare.com');
  });

  it('defaults to http only for localhost', () => {
    expect(publicOrigin(h({ host: 'localhost:3000' }), {})).toBe('http://localhost:3000');
    expect(publicOrigin(h({ host: 'example.org' }), {})).toBe('https://example.org');
  });

  it('refuses a host header that is not a host', () => {
    expect(publicOrigin(h({ host: 'a b/<script>' }), {})).toBe('http://localhost:3000');
  });
});
