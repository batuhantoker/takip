import { addressBlock } from '../access/client-ip';
import type { Principal } from '../access/principal';
import { createTokenBuckets } from '../access/token-buckets';

// The caller units access/limits.ts meters: a key, an account, or an anonymous visitor's address block.
const callerKey = (p: Principal) =>
  p.kind === 'key' ? `key:${p.keyId}` : p.kind === 'user' ? `user:${p.userId}` : `ip:${addressBlock(p.ip)}`;

/**
 * A route's own limit, on top of the caller's plan: `perMinute` requests per caller, refilling evenly,
 * for routes that would otherwise let one caller spend an upstream's allowance. True when refused.
 */
export function perCallerLimit(perMinute: number) {
  const buckets = createTokenBuckets();
  return (principal: Principal) => !buckets.take(callerKey(principal), perMinute / 60, perMinute).allowed;
}
