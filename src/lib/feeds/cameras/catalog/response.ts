import type { Payload } from '@/lib/feeds/cameras/catalog/snapshot';

/**
 * The bytes are already serialised and gzipped, so a request costs a buffer
 * write. An unchanged catalogue answers a returning visitor with a 304.
 */
export function servePayload(request: Request, ready: Payload) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=600',
    'Vary': 'Accept-Encoding',
    'ETag': ready.etag,
  };
  if (request.headers.get('if-none-match') === ready.etag) return new Response(null, { status: 304, headers });

  if ((request.headers.get('accept-encoding') || '').includes('gzip')) {
    headers['Content-Encoding'] = 'gzip';
    return new Response(new Uint8Array(ready.gzip), { headers });
  }
  return new Response(new Uint8Array(ready.json), { headers });
}
