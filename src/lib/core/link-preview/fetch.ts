import { safeFetch } from '@/lib/core/net/ssrf-guard';
import { readCapped } from '@/lib/core/net/read-capped';
import { parseLinkPreview, type LinkPreview } from './parse';

/**
 * Server side: a page's preview card, read from its `<head>` through the SSRF
 * guard. Only the first half-megabyte is read, and the body never leaves the
 * server; the reader gets the title, description, picture URL and site name.
 */

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const HEAD_CAP = 512_000;
const TIMEOUT_MS = 7_000;
const HIT_TTL_MS = 6 * 3_600_000;
// A page that failed may only have been slow; ask again later, not every click.
const MISS_TTL_MS = 20 * 60_000;
const MAX_ENTRIES = 3_000;

const cache = new Map<string, { at: number; value: LinkPreview | null }>();
const pending = new Map<string, Promise<LinkPreview | null>>();

/** The URL a preview is cached under: http(s) only, no fragment, default port dropped. Null when it is not a web page address. */
export function previewKey(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

async function load(url: string): Promise<LinkPreview | null> {
  const res = await safeFetch(url, {
    headers: { 'user-agent': BROWSER_UA, accept: 'text/html,application/xhtml+xml', 'accept-language': 'en;q=0.9,*;q=0.5' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    maxRedirects: 5,
  });
  if (!res.ok || !/html/i.test(res.headers.get('content-type') ?? '')) {
    await res.body?.cancel().catch(() => undefined);
    return null;
  }
  const finalUrl = res.url || url;
  // An article that redirects to the front page is gone; the front page's card would describe something else.
  if (new URL(finalUrl).pathname === '/' && new URL(url).pathname !== '/') {
    await res.body?.cancel().catch(() => undefined);
    return null;
  }
  const preview = parseLinkPreview(await readCapped(res, HEAD_CAP, /<\/head>/i), finalUrl);
  return preview.title || preview.description || preview.image ? preview : null;
}

/** The cached preview, null for a page known to have none, undefined when it has not been read. */
export function peekLinkPreview(raw: string): LinkPreview | null | undefined {
  const url = previewKey(raw);
  const hit = url ? cache.get(url) : undefined;
  return hit && Date.now() - hit.at < (hit.value ? HIT_TTL_MS : MISS_TTL_MS) ? hit.value : undefined;
}

const WARM_AT_ONCE = 4;
const WARM_QUEUE_MAX = 300;
const queue: string[] = [];
let warming = 0;

/** Reads previews in the background, a few at a time, so the next answer that peeks finds them. */
export function warmLinkPreviews(urls: string[]): void {
  for (const raw of urls) {
    const url = previewKey(raw);
    if (!url || queue.length >= WARM_QUEUE_MAX || pending.has(url) || queue.includes(url) || peekLinkPreview(url) !== undefined) continue;
    queue.push(url);
  }
  while (warming < WARM_AT_ONCE && queue.length) {
    warming++;
    readLinkPreview(queue.shift()!).finally(() => { warming--; warmLinkPreviews([]); });
  }
}

export async function readLinkPreview(raw: string): Promise<LinkPreview | null> {
  const url = previewKey(raw);
  if (!url) return null;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < (hit.value ? HIT_TTL_MS : MISS_TTL_MS)) return hit.value;
  const inFlight = pending.get(url);
  if (inFlight) return inFlight;

  const job = load(url)
    .catch(() => null)
    .then(value => {
      cache.delete(url);
      cache.set(url, { at: Date.now(), value });
      if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
      return value;
    })
    .finally(() => pending.delete(url));
  pending.set(url, job);
  return job;
}
