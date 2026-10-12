import { bucketKey } from '../access/limits';
import type { Principal } from '../access/principal';
import { createTokenBuckets } from '../access/token-buckets';

/**
 * A route's own limit, on top of the caller's plan: `perMinute` requests per caller, refilling evenly,
 * for routes that would otherwise let one caller spend an upstream's allowance. True when refused.
 */
export function perCallerLimit(perMinute: number) {
  const buckets = createTokenBuckets();
  return (principal: Principal) => !buckets.take(bucketKey(principal), perMinute / 60, perMinute).allowed;
}
