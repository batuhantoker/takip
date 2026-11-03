import { afterEach, describe, it, expect, vi } from 'vitest';
import { clientAddress, getClientIp, isRateLimited, isPublicIp, validateHost, visitorIp } from './ssrf-guard';

const req = (headers: Record<string, string>) => new Request('https://takip.test/api/scanner', { headers });

describe('getClientIp', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /* The bypass: the leftmost X-Forwarded-For entry is written by the client,
     so a new value per request bought a new rate-limit bucket per request. */
  it('ignores the client-written left entry and uses the proxy-observed right one', () => {
    expect(getClientIp(req({ 'x-forwarded-for': '1.1.1.1, 203.0.113.9' }))).toBe('203.0.113.9');
    expect(getClientIp(req({ 'x-forwarded-for': '9.9.9.9, 203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('believes no edge header unless one is configured, since any client can send them', () => {
    const forged = { 'cf-connecting-ip': '198.51.100.4', 'true-client-ip': '198.51.100.5', 'x-vercel-forwarded-for': '198.51.100.6', 'x-real-ip': '198.51.100.7' };
    expect(getClientIp(req({ ...forged, 'x-forwarded-for': '203.0.113.9' }))).toBe('203.0.113.9');
    expect(getClientIp(req(forged))).toBe('unknown');
  });

  it('prefers the configured edge header over anything forwarded', () => {
    vi.stubEnv('CLIENT_IP_HEADER', 'cf-connecting-ip');
    expect(getClientIp(req({ 'cf-connecting-ip': '198.51.100.4', 'x-forwarded-for': 'attacker-controlled, 203.0.113.9' }))).toBe('198.51.100.4');
    expect(getClientIp(req({ 'x-real-ip': '198.51.100.7', 'x-forwarded-for': '203.0.113.9' }))).toBe('203.0.113.9');
    expect(getClientIp(req({ 'cf-connecting-ip': 'junk', 'x-forwarded-for': '203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('counts the configured proxy hops from the right', () => {
    // Cloudflare appends the visitor, then nginx appends Cloudflare.
    vi.stubEnv('TRUSTED_PROXY_HOPS', '2');
    expect(getClientIp(req({ 'x-forwarded-for': 'forged, 81.2.69.142, 172.70.1.1' }))).toBe('81.2.69.142');
    // Fewer entries than proxies: the request skipped one, so nothing in it is ours.
    expect(getClientIp(req({ 'x-forwarded-for': '203.0.113.9' }))).toBe('unknown');
  });

  it('believes no header at all with zero hops', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '0');
    expect(getClientIp(req({ 'x-forwarded-for': '203.0.113.9' }))).toBe('unknown');
  });

  it('keeps the one-hop default for a value it cannot read', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', 'two');
    expect(getClientIp(req({ 'x-forwarded-for': '1.1.1.1, 203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('collapses junk to one shared bucket instead of a fresh one each time', () => {
    expect(getClientIp(req({ 'x-forwarded-for': 'not-an-ip' }))).toBe('unknown');
    expect(getClientIp(req({ 'x-forwarded-for': 'also-not-an-ip' }))).toBe('unknown');
    expect(getClientIp(req({}))).toBe('unknown');
  });

  it('accepts IPv6, bracketed or bare, and keys it by its /64', () => {
    expect(getClientIp(req({ 'x-forwarded-for': '2001:db8::1' }))).toBe('2001:db8::/64');
    vi.stubEnv('CLIENT_IP_HEADER', 'x-real-ip');
    expect(getClientIp(req({ 'x-real-ip': '[2001:db8::1]' }))).toBe('2001:db8::/64');
  });

  it('reads an IPv4-mapped address as its IPv4', () => {
    expect(getClientIp(req({ 'x-forwarded-for': '::ffff:203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('still hands on the exact address for the api, which keys it itself', () => {
    expect(clientAddress(req({ 'x-forwarded-for': '1.1.1.1, 2001:db8:1:2::abcd' }))).toBe('2001:db8:1:2::abcd');
    expect(clientAddress(req({ 'x-forwarded-for': '::ffff:203.0.113.9' }))).toBe('203.0.113.9');
    expect(clientAddress(req({ 'x-forwarded-for': 'dead:beef' }))).toBeNull();
  });
});

describe('scanner throttle under a spoofed header', () => {
  it('still binds when the attacker rotates the left entry every request', () => {
    const limit = 5;
    let blocked = 0;
    for (let i = 0; i < 20; i++) {
      const ip = getClientIp(req({ 'x-forwarded-for': `10.0.0.${i}, 203.0.113.42` }));
      if (isRateLimited(ip, limit, 60_000)) blocked++;
    }
    // 20 requests, 5 allowed: the rotation buys nothing.
    expect(blocked).toBe(15);
  });

  it('still binds when an IPv6 client rotates through its /64', () => {
    let blocked = 0;
    for (let i = 1; i <= 20; i++) {
      const ip = getClientIp(req({ 'x-forwarded-for': `2001:db8:77:1:${i.toString(16)}::${i.toString(16)}` }));
      if (isRateLimited(`scan:${ip}`, 5, 60_000)) blocked++;
    }
    expect(blocked).toBe(15);
    expect(isRateLimited(`scan:${getClientIp(req({ 'x-forwarded-for': '2001:db8:77:2::1' }))}`, 5, 60_000)).toBe(false);
  });
});

describe('isPublicIp', () => {
  it('keeps public 172.x and drops only 172.16/12', () => {
    expect(isPublicIp('172.56.10.20')).toBe(true);   // T-Mobile US
    expect(isPublicIp('172.217.4.14')).toBe(true);   // Google
    expect(isPublicIp('172.32.0.1')).toBe(true);
    expect(isPublicIp('172.16.0.1')).toBe(false);
    expect(isPublicIp('172.31.255.255')).toBe(false);
  });

  it('rejects loopback, private, CGNAT and reserved IPv6', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.1.5', '100.89.48.10', '::1', 'fd00::1', 'fe80::1', '']) {
      expect(isPublicIp(ip)).toBe(false);
    }
  });

  it('accepts public IPv6 and judges an IPv4-mapped address by its IPv4', () => {
    expect(isPublicIp('2a00:1450:4001:80b::200e')).toBe(true);
    expect(isPublicIp('::ffff:81.2.69.142')).toBe(true);
    expect(isPublicIp('::ffff:10.0.0.1')).toBe(false);
  });

  it('rejects things that are not addresses', () => {
    expect(isPublicIp('unknown')).toBe(false);
    expect(isPublicIp('2130706433')).toBe(false);
  });
});

describe('validateHost', () => {
  it('blocks reserved IPv6 written in long or hex form', async () => {
    for (const ip of ['0::1', '0:0:0:0:0:0:0:1', '[0::ffff:192.168.1.1]', '0:0:0:0:0:ffff:7f00:1', '::ffff:a00:1', 'FE80::1', '0064:ff9b::a00:1', 'fe80::1%eth0']) {
      expect((await validateHost(ip)).ok, ip).toBe(false);
    }
  });

  it('passes a public IPv6 and hands back the form it checked', async () => {
    expect(await validateHost('[2606:4700:0:0:0:0:0:1111]')).toEqual({ ok: true, resolved: ['2606:4700::1111'] });
  });
});

describe('visitorIp', () => {
  it('prefers the edge header', () => {
    expect(visitorIp(req({ 'cf-connecting-ip': '81.2.69.142', 'x-forwarded-for': '8.8.8.8' }))).toBe('81.2.69.142');
  });

  it('skips a proxy-internal address and finds the visitor further down', () => {
    // A container network in front of the app: x-real-ip is the proxy itself.
    expect(visitorIp(req({ 'x-real-ip': '172.18.0.5', 'x-forwarded-for': '172.56.10.20, 172.18.0.5' }))).toBe('172.56.10.20');
  });

  it('returns null rather than a private address', () => {
    expect(visitorIp(req({ 'x-forwarded-for': '10.0.0.4, 127.0.0.1' }))).toBeNull();
    expect(visitorIp(req({}))).toBeNull();
  });
});
