import { crawlerOf } from '@takip/core/crawlers';

const FLUSH_MS = 30_000;
const MAX_BUFFER = 5000;
// Same default as next.config.ts's rewrites; /internal is only served to callers on the api's own machine.
const ENDPOINT = `${process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4100'}/internal/crawl`;

type Hit = { at: number; bot: string; path: string };

let buffer: Hit[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  timer = null;
  const hits = buffer;
  buffer = [];
  try {
    await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ hits }) });
  } catch {
    // The api is down or restarting: these few are lost, and the counts stay a lower bound.
  }
}

/**
 * Notes a request from a crawler or script (by its user agent; packages/core crawlers.ts) for Admin → Analytics →
 * Crawlers. Browsers are ignored. Held here and handed to the api every 30 seconds, so a page never waits on it.
 */
export function noteCrawler(userAgent: string | null, path: string) {
  const bot = crawlerOf(userAgent);
  if (!bot) return;
  if (buffer.length < MAX_BUFFER) buffer.push({ at: Date.now(), bot: bot.name, path: path.slice(0, 300) });
  timer ??= setTimeout(() => void flush(), FLUSH_MS);
}
