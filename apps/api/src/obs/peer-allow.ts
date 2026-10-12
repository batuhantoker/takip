import { BlockList } from 'node:net';
import { ipFamily, parseCidr } from '../net/cidr';

const LOOPBACK = ['127.0.0.0/8', '::1'];

/** Whether a socket peer is loopback or inside one of `cidrs`. IPv4-mapped IPv6 peers match IPv4 rules. */
export function peerAllowList(cidrs: readonly string[]) {
  const list = new BlockList();
  for (const rule of [...LOOPBACK, ...cidrs]) {
    const cidr = parseCidr(rule);
    if (!cidr) throw new Error(`not a CIDR: ${rule}`);
    list.addSubnet(cidr.address, cidr.prefix, cidr.type);
  }
  return (address: string | undefined) => {
    const type = address ? ipFamily(address) : undefined;
    return !!type && list.check(address!, type);
  };
}
