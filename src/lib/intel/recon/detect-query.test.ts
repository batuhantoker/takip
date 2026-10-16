import { describe, expect, it } from 'vitest';
import { detectQuery } from './detect-query';

describe('detectQuery', () => {
  const kind = (q: string) => detectQuery(q).kind;
  const first = (q: string) => detectQuery(q).tools[0];

  it('reads IPv4 and runs network owner first', () => {
    expect(kind('8.8.8.8')).toBe('ipv4');
    expect(first('8.8.8.8')).toBe('bgp');
    expect(kind('999.1.1.1')).not.toBe('ipv4');
  });

  it('tells a MAC address from IPv6 (both have colons)', () => {
    expect(kind('00:1A:2B:3C:4D:5E')).toBe('mac');
    expect(kind('2001:4860:4860::8888')).toBe('ipv6');
  });

  it('reads email before treating it as a domain', () => {
    expect(kind('ada@example.com')).toBe('email');
    expect(first('ada@example.com')).toBe('leaks');
  });

  it('reads domains and web addresses', () => {
    expect(kind('example.com')).toBe('domain');
    expect(first('example.com')).toBe('dns');
    expect(kind('https://example.com/path')).toBe('url');
    expect(first('https://example.com/path')).toBe('headers');
  });

  it('reads ASN and CVE ids', () => {
    expect(kind('AS15169')).toBe('asn');
    expect(kind('CVE-2021-44228')).toBe('cve');
  });

  it('reads phone numbers', () => {
    expect(kind('+1 202 555 0147')).toBe('phone');
    expect(kind('123')).not.toBe('phone');
  });

  it('reads crypto wallets', () => {
    expect(kind('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe('wallet');
    expect(kind('0x742d35Cc6634C0532925a3b844Bc454e4438f44e')).toBe('wallet');
  });

  it('falls back to username for plain handles', () => {
    expect(kind('ada_lovelace')).toBe('username');
    expect(first('ada_lovelace')).toBe('fingerprint');
  });

  it('is empty for nothing typed', () => {
    expect(detectQuery('   ')).toEqual({ kind: 'unknown', label: '', tools: [] });
  });
});
