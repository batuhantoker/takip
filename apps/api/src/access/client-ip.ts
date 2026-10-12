import { BlockList, isIP } from 'node:net';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { convertIPv6ToBinary } from 'hono/utils/ipaddr';
import { parseCidr } from '../net/cidr';

/** Better Auth reads the client IP from here (auth.ts). Always overwritten by `clientIp`, never taken from the caller. */
export const RESOLVED_IP_HEADER = 'x-resolved-client-ip';
export const UNKNOWN_IP = 'unknown';
export const LOOPBACK = '127.0.0.0/8,::1';

export type IpTrust = { proxies: BlockList; cloudflare: boolean };
export type ClientIpEnv = { Variables: { clientIp: string } };

/** `[::1]:443`, `fe80::1%en0`, `::ffff:10.0.0.1` and `1.2.3.4:80` as bare addresses; null when it isn't one. */
export function canonicalIp(value: string | null | undefined): string | null {
  let ip = value?.trim().toLowerCase() ?? '';
  if (ip.startsWith('[')) ip = ip.slice(1, ip.indexOf(']'));
  else if (/^[\d.]+:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(':'));
  ip = ip.split('%')[0].replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/, '');
  return isIP(ip) ? ip : null;
}

/** The address part as canonicalIp reads it (`[::1]/128` → `::1/128`); unchanged when it isn't one. */
function canonicalRule(entry: string) {
  const slash = entry.indexOf('/');
  const ip = canonicalIp(slash < 0 ? entry : entry.slice(0, slash));
  return ip ? ip + (slash < 0 ? '' : entry.slice(slash)) : entry;
}

/** Comma-separated IPs and CIDR ranges; throws on an entry that is neither. */
export function parseProxies(list: string): BlockList {
  const proxies = new BlockList();
  for (const entry of list.split(',').map(s => s.trim()).filter(Boolean)) {
    const cidr = parseCidr(canonicalRule(entry));
    if (!cidr) throw new Error(`not an IP address or CIDR range: ${entry}`);
    proxies.addSubnet(cidr.address, cidr.prefix, cidr.type);
  }
  return proxies;
}

export function ipTrust({ trustedProxies = LOOPBACK, cloudflare = false } = {}): IpTrust {
  return { proxies: parseProxies(trustedProxies), cloudflare };
}

const trusted = (trust: IpTrust, ip: string) => trust.proxies.check(ip, isIP(ip) === 4 ? 'ipv4' : 'ipv6');

/**
 * The socket peer, unless it is one of our proxies. Then cf-connecting-ip when Cloudflare is the declared
 * edge, else the rightmost X-Forwarded-For hop that isn't a proxy: entries further left are client-written.
 */
export function resolveClientIp(peerAddress: string | undefined, headers: Headers, trust: IpTrust): string {
  const peer = canonicalIp(peerAddress);
  if (!peer) return UNKNOWN_IP;
  if (!trusted(trust, peer)) return peer;
  if (trust.cloudflare) {
    const edge = canonicalIp(headers.get('cf-connecting-ip'));
    if (edge) return edge;
  }
  let nearest = peer;
  const hops = (headers.get('x-forwarded-for') ?? '').split(',').map(s => s.trim()).filter(Boolean);
  for (let i = hops.length - 1; i >= 0; i--) {
    const hop = canonicalIp(hops[i]);
    // Junk where a proxy should have written an address: believe nothing further left.
    if (!hop) return nearest;
    if (!trusted(trust, hop)) return hop;
    nearest = hop;
  }
  return nearest;
}

/** The unit one visitor controls: an IPv4 address, or an IPv6 /64. */
export function addressBlock(ip: string): string {
  return isIP(ip) === 6 ? `${(convertIPv6ToBinary(ip) >> 64n).toString(16)}::/64` : ip;
}

type SocketBindings = { incoming?: { socket?: { remoteAddress?: string } } } | undefined;
const peerOf = (c: Context) => (c.env as SocketBindings)?.incoming?.socket?.remoteAddress;

/** Resolves the client IP once per request and hands it to Better Auth for session records and its limiter. */
export function clientIp(trust: IpTrust) {
  return createMiddleware<ClientIpEnv>(async (c, next) => {
    const ip = resolveClientIp(peerOf(c), c.req.raw.headers, trust);
    c.set('clientIp', ip);
    if (ip === UNKNOWN_IP) c.req.raw.headers.delete(RESOLVED_IP_HEADER);
    else c.req.raw.headers.set(RESOLVED_IP_HEADER, ip);
    await next();
  });
}

/** What `clientIp` resolved; outside it (a bare sub-app), the socket peer alone. */
export function clientIpOf(c: Context): string {
  const resolved: unknown = c.get('clientIp');
  return typeof resolved === 'string' ? resolved : canonicalIp(peerOf(c)) ?? UNKNOWN_IP;
}
