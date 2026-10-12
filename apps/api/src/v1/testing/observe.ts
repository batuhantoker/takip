import { clearNominatimCache } from '@takip/connectors/nominatim';
import { clearSourceCache } from '@takip/connectors/source-cache';
import { upstream } from './upstream';

export interface Observed {
  status: number;
  type: string | null;
  cache: string | null;
  body: unknown;
  /** What reached the upstreams while answering this request. */
  upstream: string[];
}

/** Sends each path in turn, starting from cold server-side caches, and records what each one did. */
export async function run(paths: string[], send: (path: string) => Response | Promise<Response>): Promise<Observed[]> {
  clearSourceCache();
  clearNominatimCache();
  const out: Observed[] = [];
  for (const path of paths) {
    upstream.calls.length = 0;
    const res = await send(path);
    out.push({
      status: res.status,
      type: res.headers.get('content-type'),
      cache: res.headers.get('cache-control'),
      body: await res.json(),
      upstream: [...upstream.calls],
    });
  }
  return out;
}
