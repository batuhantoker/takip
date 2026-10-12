import { isIP } from 'node:net';

export type IpFamily = 'ipv4' | 'ipv6';
export type Cidr = { address: string; prefix: number; type: IpFamily };

export const ipFamily = (address: string): IpFamily | undefined => ({ 4: 'ipv4', 6: 'ipv6' } as const)[isIP(address) as 4 | 6];

/** `10.0.0.0/8`, `fd00::/8` or a bare address; null when malformed. */
export function parseCidr(rule: string): Cidr | null {
  const [address, bits, ...rest] = rule.split('/');
  const type = ipFamily(address);
  if (!type || rest.length || (bits !== undefined && !/^\d{1,3}$/.test(bits))) return null;
  const max = type === 'ipv4' ? 32 : 128;
  const prefix = bits === undefined ? max : Number(bits);
  return prefix <= max ? { address, prefix, type } : null;
}
