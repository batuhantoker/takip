import { BlockList, isIP } from 'node:net';

const LOOPBACK = ['127.0.0.0/8', '::1'];

const family = (address: string) => ({ 4: 'ipv4', 6: 'ipv6' } as const)[isIP(address) as 4 | 6];

/** `10.0.0.0/8`, `fd00::/8` or a bare address; null when malformed. */
export function parseCidr(rule: string) {
  const [address, bits, ...rest] = rule.split('/');
  const type = family(address);
  if (!type || rest.length || (bits !== undefined && !/^\d{1,3}$/.test(bits))) return null;
  const max = type === 'ipv4' ? 32 : 128;
  const prefix = bits === undefined ? max : Number(bits);
  return prefix <= max ? { address, prefix, type } : null;
}

/** Whether a socket peer is loopback or inside one of `cidrs`. IPv4-mapped IPv6 peers match IPv4 rules. */
export function peerAllowList(cidrs: readonly string[]) {
  const list = new BlockList();
  for (const rule of [...LOOPBACK, ...cidrs]) {
    const cidr = parseCidr(rule);
    if (!cidr) throw new Error(`not a CIDR: ${rule}`);
    list.addSubnet(cidr.address, cidr.prefix, cidr.type);
  }
  return (address: string | undefined) => {
    const type = address ? family(address) : undefined;
    return !!type && list.check(address!, type);
  };
}
