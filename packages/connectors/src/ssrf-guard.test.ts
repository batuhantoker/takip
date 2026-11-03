import { lookup } from 'node:dns/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pinnedAgent } from './pinned-agent';
import { addressBlock, canonicalIp, isRateLimited, rateLimitWait, safeFetch } from './ssrf-guard';

vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }));
vi.mock('./pinned-agent', async importOriginal => {
  const real = await importOriginal<typeof import('./pinned-agent')>();
  return { ...real, pinnedAgent: vi.fn(real.pinnedAgent) };
});

const dns = vi.mocked(lookup) as unknown as ReturnType<typeof vi.fn>;
const answer = (address: string) => [{ address, family: address.includes(':') ? 6 : 4 }];

describe('safeFetch under DNS rebinding', () => {
  const fetch = vi.fn<typeof globalThis.fetch>();

  beforeEach(() => {
    dns.mockReset();
    fetch.mockReset();
    vi.mocked(pinnedAgent).mockClear();
    vi.stubGlobal('fetch', fetch);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('connects to the address it checked, though a second lookup would answer loopback', async () => {
    dns.mockResolvedValueOnce(answer('93.184.216.34')).mockResolvedValue(answer('127.0.0.1'));
    fetch.mockResolvedValue(new Response('ok'));

    await safeFetch('http://rebind.example/page');

    expect(vi.mocked(pinnedAgent).mock.calls).toEqual([[['93.184.216.34']]]);
    const init = fetch.mock.calls[0][1] as RequestInit & { dispatcher?: object };
    expect(init.dispatcher).toBe(vi.mocked(pinnedAgent).mock.results[0].value);
    expect(init.redirect).toBe('manual');
    expect(dns).toHaveBeenCalledTimes(1);
  });

  it('checks and pins every redirect hop afresh, and refuses one that lands on a private address', async () => {
    dns.mockResolvedValueOnce(answer('93.184.216.34')).mockResolvedValueOnce(answer('10.0.0.5'));
    fetch.mockResolvedValue(new Response(null, { status: 302, headers: { location: 'http://intranet.example/' } }));

    await expect(safeFetch('http://rebind.example/')).rejects.toThrow(/reserved IPv4 10\.0\.0\.5/);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(dns.mock.calls.map(c => c[0])).toEqual(['rebind.example', 'intranet.example']);
  });
});

describe('addressBlock', () => {
  it('keys IPv6 by its /64, whatever the host part and however it is written', () => {
    for (const ip of ['2001:db8:1:2::1', '2001:db8:1:2:aaaa:bbbb:cccc:dddd', '[2001:DB8:1:2::1]', '2001:0db8:0001:0002:0:0:0:9']) {
      expect(addressBlock(ip), ip).toBe('2001:db8:1:2::/64');
    }
    expect(addressBlock('2001:db8:1:3::1')).toBe('2001:db8:1:3::/64');
    expect(addressBlock('fe80::1%en0')).toBe('fe80::/64');
  });

  it('reads an IPv4-mapped IPv6 address as the IPv4 address it carries', () => {
    for (const ip of ['::ffff:203.0.113.9', '::ffff:cb00:7109', '0:0:0:0:0:ffff:cb00:7109', '[::FFFF:203.0.113.9]']) {
      expect(addressBlock(ip), ip).toBe('203.0.113.9');
    }
  });

  it('keeps IPv4 as it is and leaves what is not an address alone', () => {
    expect(addressBlock('203.0.113.9')).toBe('203.0.113.9');
    expect(addressBlock('unknown')).toBe('unknown');
    expect(canonicalIp('dead:beef')).toBeNull();
  });
});

describe('the shared limiter', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('binds an IPv6 client rotating addresses inside its /64', () => {
    let blocked = 0;
    for (let i = 1; i <= 20; i++) {
      if (isRateLimited(`2001:db8:aa:1::${i.toString(16)}`, 5)) blocked++;
    }
    expect(blocked).toBe(15);
    expect(isRateLimited('2001:db8:aa:2::1', 5)).toBe(false);
  });

  it('says how long to wait once a key is over its limit', () => {
    vi.useFakeTimers({ now: Date.UTC(2030, 0, 1) });
    expect(rateLimitWait('wait-test', 2, 60_000)).toBe(0);
    expect(rateLimitWait('wait-test', 2, 60_000)).toBe(0);
    expect(rateLimitWait('wait-test', 2, 60_000)).toBe(60);
    vi.advanceTimersByTime(30_000);
    expect(rateLimitWait('wait-test', 2, 60_000)).toBe(30);
    vi.advanceTimersByTime(31_000);
    expect(rateLimitWait('wait-test', 2, 60_000)).toBe(0);
  });

  it('sweeps expired entries now and then, not on every request', () => {
    vi.useFakeTimers({ now: Date.UTC(2031, 0, 1) });
    const scans = vi.spyOn(Map.prototype, Symbol.iterator);
    for (let i = 0; i < 2_000; i++) isRateLimited(`flood-${i}`, 5);
    expect(scans).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(31_000);
    isRateLimited('flood-late', 5);
    expect(scans).toHaveBeenCalledTimes(2);
  });
});
