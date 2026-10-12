import { describe, expect, it } from 'vitest';
import { parseProxies } from '../access/client-ip';
import { loadEnv } from '../env';
import { peerAllowList } from '../obs/peer-allow';

const accepts = (parse: () => unknown) => {
  try {
    parse();
    return true;
  } catch {
    return false;
  }
};
const both = (rule: string) => [accepts(() => parseProxies(rule)), accepts(() => loadEnv({ METRICS_ALLOW: rule }))];

describe('CIDR rules', () => {
  it('are read alike by TRUSTED_PROXIES and METRICS_ALLOW', () => {
    for (const rule of ['10.0.0.0/8', 'fd00::/8', 'FD00::/8', '192.168.1.7', '::1', '0.0.0.0/0', '::/0', '10.0.0.0/08']) {
      expect(both(rule), rule).toEqual([true, true]);
    }
    for (const rule of ['10.0.0.0/33', '::/129', '10.0.0/8', '10.0.0.0/', '10.0.0.0/8/1', 'localhost', '10.0.0.0/+8', '01.2.3.4', '/8']) {
      expect(both(rule), rule).toEqual([false, false]);
    }
  });

  it('take a proxy in the forms headers carry it, but only bare addresses in METRICS_ALLOW', () => {
    for (const rule of ['[::1]', '[::1]/128', '127.0.0.1:80', '[::1]:443/64']) expect(both(rule), rule).toEqual([true, false]);
    // TRUSTED_PROXIES reads ::ffff:a.b.c.d as IPv4, so the prefix is an IPv4 one.
    expect(both('::ffff:10.0.0.0/104')).toEqual([false, true]);
    expect(parseProxies('::ffff:10.0.0.0/8').check('10.1.2.3', 'ipv4')).toBe(true);
    expect(peerAllowList(['::ffff:10.0.0.0/104'])('10.1.2.3')).toBe(true);
  });
});
