import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

/** A response body serialised and gzipped once, for a route that answers many callers with the same bytes. */
export interface Prebuilt {
  json: Buffer;
  gzip: Buffer;
  etag: string;
}

export function prebuild(body: unknown): Prebuilt {
  const json = Buffer.from(JSON.stringify(body));
  return { json, gzip: gzipSync(json, { level: 6 }), etag: `W/"${createHash('sha1').update(json).digest('base64url')}"` };
}

/** The prebuilt bytes, or a 304 when the caller already holds them. */
export function servePrebuilt(request: Request, body: Prebuilt, cacheControl: string): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cacheControl,
    'Vary': 'Accept-Encoding',
    'ETag': body.etag,
  };
  if (request.headers.get('if-none-match') === body.etag) return new Response(null, { status: 304, headers });
  if ((request.headers.get('accept-encoding') || '').includes('gzip')) {
    headers['Content-Encoding'] = 'gzip';
    return new Response(new Uint8Array(body.gzip), { headers });
  }
  return new Response(new Uint8Array(body.json), { headers });
}
