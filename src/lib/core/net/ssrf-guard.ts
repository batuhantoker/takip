import { addressBlock, bareIp, canonicalIp, isPublicIp } from '@takip/connectors/ssrf-guard';

export * from '@takip/connectors/ssrf-guard';

// Header-reading helpers stay in the web app; the api resolves client IPs itself (apps/api/src/access/client-ip.ts).

/**
 * Best available identity for the caller, for rate-limiting purposes: their
 * address, with IPv6 cut to its /64 (addressBlock).
 *
 * A route handler can't see the socket peer, and Next passes on whatever
 * `X-Forwarded-For` the client sent, so which header to believe is deployment
 * config (`.env.example`):
 *   TRUSTED_PROXY_HOPS  proxies in front of Next that append to X-Forwarded-For
 *                       (default 1). The client is that many entries from the
 *                       right; entries further left are client-written. 0 means
 *                       Next faces the internet and no header is believed.
 *   CLIENT_IP_HEADER    a header the edge sets and overwrites, such as
 *                       cf-connecting-ip or x-real-ip. Unset by default: from
 *                       anywhere else these headers are as forgeable as the rest.
 * Anything that does not parse as an address collapses to a single shared
 * 'unknown' bucket, which throttles unidentifiable callers together rather
 * than exempting them.
 */
export function getClientIp(req: Request): string {
  const ip = clientAddress(req);
  return ip ? addressBlock(ip) : 'unknown';
}

/** The caller's own address, read as getClientIp reads it, or null. For handing on to the api, which keys it itself. */
export function clientAddress(req: Request): string | null {
  const h = (name: string) => req.headers.get(name)?.trim() || '';

  const edgeHeader = process.env.CLIENT_IP_HEADER?.trim();
  const edge = edgeHeader ? canonicalIp(h(edgeHeader)) : null;
  if (edge) return edge;

  const chain = h('x-forwarded-for').split(',').map(s => s.trim()).filter(Boolean);
  const hops = trustedProxyHops();
  const client = hops > 0 ? chain[chain.length - hops] : undefined;
  return client ? canonicalIp(client) : null;
}

function trustedProxyHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS?.trim() ?? '';
  return /^\d+$/.test(raw) ? Number(raw) : 1;
}
/**
 * The visitor's own address, for geolocation: the first public one among the
 * headers an edge or proxy sets, or null when there is none.
 *
 * Unlike getClientIp this reads X-Forwarded-For left to right. The leftmost
 * entry is client-written, and here that is fine: a forged value only
 * mislocates the person who forged it, while the rightmost entry is often a
 * CDN edge in another city.
 */
export function visitorIp(req: Request): string | null {
  const candidates = ['cf-connecting-ip', 'true-client-ip', 'x-vercel-forwarded-for', 'x-real-ip', 'x-forwarded-for']
    .flatMap(name => (req.headers.get(name) || '').split(','))
    .map(s => s.trim())
    .filter(Boolean);
  const found = candidates.find(isPublicIp);
  return found ? bareIp(found) : null;
}
