import type { Payload } from '@/lib/feeds/cameras/catalog/snapshot';
import { servePrebuilt } from '@/lib/core/net/prebuilt';

/**
 * The bytes are already serialised and gzipped, so a request costs a buffer
 * write. An unchanged catalogue answers a returning visitor with a 304.
 */
export function servePayload(request: Request, ready: Payload, format: 'full' | 'pins' = 'full') {
  return servePrebuilt(request, format === 'pins' ? ready.pins : ready, 'public, max-age=60, stale-while-revalidate=600');
}
