import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ORIGIN, USER, startApp, type TestApp } from '../testing/helpers';
import { loadEnv } from '../env';
import { RESOLVED_IP_HEADER, addressBlock, canonicalIp, ipTrust, parseProxies, resolveClientIp } from './client-ip';

const loopback = ipTrust();
const resolve = (peer: string | undefined, headers: Record<string, string> = {}, trust = loopback) =>
  resolveClientIp(peer, new Headers(headers), trust);

describe('resolveClientIp', () => {
  it('takes an untrusted peer as it is, whatever it claims in headers', () => {
    expect(resolve('198.51.100.20', { 'x-forwarded-for': '203.0.113.7', 'cf-connecting-ip': '203.0.113.8' })).toBe('198.51.100.20');
    expect(resolve('198.51.100.20', {}, ipTrust({ cloudflare: true }))).toBe('198.51.100.20');
    expect(resolve('198.51.100.20', { 'cf-connecting-ip': '203.0.113.8' }, ipTrust({ cloudflare: true }))).toBe('198.51.100.20');
  });

  it('believes X-Forwarded-For from a trusted proxy, reading from the right', () => {
    expect(resolve('127.0.0.1', { 'x-forwarded-for': '203.0.113.7' })).toBe('203.0.113.7');
    // The left entry is client-written; the right one is what our proxy saw.
    expect(resolve('127.0.0.1', { 'x-forwarded-for': '1.1.1.1, 203.0.113.7' })).toBe('203.0.113.7');
    expect(resolve('::ffff:127.0.0.1', { 'x-forwarded-for': '203.0.113.7' })).toBe('203.0.113.7');
  });

  it('skips every hop that is itself a trusted proxy', () => {
    const trust = ipTrust({ trustedProxies: '127.0.0.1, 10.0.0.0/8' });
    expect(resolve('127.0.0.1', { 'x-forwarded-for': '9.9.9.9, 203.0.113.7, 10.1.2.3' }, trust)).toBe('203.0.113.7');
    // Only proxies in the chain: the furthest one is as close to the client as we can get.
    expect(resolve('127.0.0.1', { 'x-forwarded-for': '10.0.0.9, 10.1.2.3' }, trust)).toBe('10.0.0.9');
  });

  it('falls back to the nearest proxy when the chain holds junk or nothing', () => {
    expect(resolve('127.0.0.1')).toBe('127.0.0.1');
    expect(resolve('127.0.0.1', { 'x-forwarded-for': '203.0.113.7, not-an-ip' })).toBe('127.0.0.1');
  });

  it('believes cf-connecting-ip only when Cloudflare is declared the edge', () => {
    const headers = { 'cf-connecting-ip': '203.0.113.8', 'x-forwarded-for': '203.0.113.7' };
    expect(resolve('127.0.0.1', headers)).toBe('203.0.113.7');
    expect(resolve('127.0.0.1', headers, ipTrust({ cloudflare: true }))).toBe('203.0.113.8');
  });

  it('trusts nobody with an empty list', () => {
    expect(resolve('127.0.0.1', { 'x-forwarded-for': '203.0.113.7' }, ipTrust({ trustedProxies: '' }))).toBe('127.0.0.1');
  });

  it('answers unknown without a peer', () => {
    expect(resolve(undefined, { 'x-forwarded-for': '203.0.113.7' })).toBe('unknown');
  });
});

describe('addresses', () => {
  it('normalises the forms proxies write', () => {
    expect(canonicalIp('[2001:DB8::1]:443')).toBe('2001:db8::1');
    expect(canonicalIp('fe80::1%en0')).toBe('fe80::1');
    expect(canonicalIp('203.0.113.7:51000')).toBe('203.0.113.7');
    expect(canonicalIp('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(canonicalIp('2130706433')).toBeNull();
  });

  it('groups an IPv6 visitor by /64, since one home gets the whole block', () => {
    expect(addressBlock('2001:db8:1:2::1')).toBe(addressBlock('2001:db8:1:2:ffff::9'));
    expect(addressBlock('2001:db8:1:2::1')).not.toBe(addressBlock('2001:db8:1:3::1'));
    expect(addressBlock('203.0.113.7')).toBe('203.0.113.7');
  });

  it('refuses a trusted-proxy list it cannot read, at boot', () => {
    expect(() => parseProxies('10.0.0.0/33')).toThrow(/10\.0\.0\.0\/33/);
    expect(() => parseProxies('nginx')).toThrow(/nginx/);
    expect(() => loadEnv({ TRUSTED_PROXIES: '127.0.0.1, proxy.internal' })).toThrow(/TRUSTED_PROXIES/);
    expect(loadEnv({ TRUSTED_PROXIES: '172.16.0.0/12, fd00::/8' }).TRUSTED_PROXIES).toBe('172.16.0.0/12, fd00::/8');
    expect(loadEnv({}).CLOUDFLARE_EDGE).toBe(false);
    expect(loadEnv({ CLOUDFLARE_EDGE: 'true' }).CLOUDFLARE_EDGE).toBe(true);
  });
});

describe('session records', () => {
  let t: TestApp;
  beforeEach(async () => {
    t = await startApp();
  });
  afterEach(() => t.close());

  const from = (remoteAddress: string) => ({ incoming: { socket: { remoteAddress } } });

  async function signInFrom(peer: string, headers: Record<string, string> = {}) {
    await t.signUpVerified();
    t.db.prepare('DELETE FROM auth_session').run();
    const res = await t.app.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
      body: JSON.stringify({ email: USER.email, password: USER.password }),
    }, from(peer));
    expect(res.status).toBe(200);
    return t.db.prepare('SELECT ipAddress FROM auth_session').pluck().all();
  }

  it('store the client behind our proxy', async () => {
    expect(await signInFrom('127.0.0.1', { 'x-forwarded-for': '1.1.1.1, 203.0.113.7' })).toEqual(['203.0.113.7']);
  });

  it('store the peer when it is not our proxy, and ignore what it forwards or forges', async () => {
    expect(await signInFrom('198.51.100.20', { 'x-forwarded-for': '203.0.113.7', [RESOLVED_IP_HEADER]: '203.0.113.9' })).toEqual(['198.51.100.20']);
  });
});
