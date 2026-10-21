import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { prebuild, servePrebuilt } from './prebuilt';

describe('prebuilt responses', () => {
  const body = prebuild({ a: 1 });
  const ask = (headers: Record<string, string>) => servePrebuilt(new Request('http://x/', { headers }), body, 'public, max-age=60');

  it('serves the gzip to a caller that takes it, and the json otherwise', async () => {
    const zipped = ask({ 'accept-encoding': 'gzip, br' });
    expect(zipped.headers.get('Content-Encoding')).toBe('gzip');
    expect(JSON.parse(gunzipSync(Buffer.from(await zipped.arrayBuffer())).toString())).toEqual({ a: 1 });
    expect(await ask({}).json()).toEqual({ a: 1 });
  });

  it('answers a caller holding the same bytes with a 304', () => {
    const response = ask({ 'if-none-match': body.etag });
    expect(response.status).toBe(304);
    expect(response.headers.get('ETag')).toBe(body.etag);
    expect(prebuild({ a: 2 }).etag).not.toBe(body.etag);
  });
});
