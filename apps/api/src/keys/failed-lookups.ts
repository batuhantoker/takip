import { addressBlock } from '../access/client-ip';
import { createTokenBuckets } from '../access/token-buckets';

/**
 * Key lookups that reached the database and found no live key, per client address block: about `perMinute`
 * a minute, then the address waits, so guessed keys can't hammer the database.
 */
export function createFailedLookups({ perMinute = 10, now = () => Date.now() } = {}) {
  const buckets = createTokenBuckets({ now });
  const rate = perMinute / 60;
  return {
    /** Seconds until this address may look a key up again; 0 when it may now. */
    waitS(ip: string) {
      const peek = buckets.peek(addressBlock(ip), rate, perMinute);
      return peek.allowed ? 0 : peek.retryAfterS;
    },
    record(ip: string) {
      buckets.take(addressBlock(ip), rate, perMinute);
    },
  };
}
