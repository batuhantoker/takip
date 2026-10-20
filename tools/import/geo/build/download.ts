import { createWriteStream, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const UA = 'TAKIP-geo-index/0.1 (https://takip.dev; hello@takip.dev)';

const STALL_MS = 90_000;
const ATTEMPTS = 40;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const backoff = (attempt: number) => Math.min(15_000 * attempt, 120_000);

/** Content-Length from a HEAD, or null when the server doesn't say. */
export async function remoteSize(url: string): Promise<number | null> {
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) });
      if (res.status === 404) return null;
      const n = Number(res.headers.get('content-length'));
      return res.ok && n > 0 ? n : null;
    } catch {
      await sleep(backoff(attempt));
    }
  }
  return null;
}

/** Streams a body to `dest` via `dest.part`, aborting when no bytes arrive for STALL_MS. */
async function pump(res: Response, part: string, append: boolean) {
  const ctl = new AbortController();
  let timer = setTimeout(() => ctl.abort(), STALL_MS);
  const body = Readable.fromWeb(res.body as import('node:stream/web').ReadableStream);
  body.on('data', () => {
    clearTimeout(timer);
    timer = setTimeout(() => ctl.abort(), STALL_MS);
  });
  try {
    await pipeline(body, createWriteStream(part, { flags: append ? 'a' : 'w' }), { signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resumable download: a partial `.part` file is continued with a Range request, and the network here drops for
 * up to a minute under load, so failures retry with backoff instead of giving up.
 */
export async function download(url: string, dest: string, log: (s: string) => void = console.log): Promise<string> {
  if (existsSync(dest)) return dest;
  mkdirSync(dirname(dest), { recursive: true });
  const part = `${dest}.part`;
  const total = await remoteSize(url);
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const have = existsSync(part) ? statSync(part).size : 0;
    if (total !== null && have === total) break;
    if (total !== null && have > total) unlinkSync(part);
    try {
      const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': UA, ...(have ? { Range: `bytes=${have}-` } : {}) } });
      if (res.status === 416 && have) break;
      if (res.status === 404) throw Object.assign(new Error(`404 ${url}`), { fatal: true });
      if (!res.ok || !res.body) throw new Error(`${res.status} ${url}`);
      const append = have > 0 && res.status === 206;
      if (attempt === 1 || !append) log(`  get ${url}${total ? ` (${(total / 2 ** 20).toFixed(1)} MB)` : ''}${append ? ` from ${(have / 2 ** 20).toFixed(1)} MB` : ''}`);
      await pump(res, part, append);
      if (total === null || statSync(part).size === total) break;
    } catch (e) {
      if ((e as { fatal?: boolean }).fatal) throw e;
      log(`  retry ${attempt}/${ATTEMPTS} ${url}: ${(e as Error).message}`);
      await sleep(backoff(attempt));
    }
  }
  const size = existsSync(part) ? statSync(part).size : 0;
  if (total !== null && size !== total) throw new Error(`incomplete ${url}: ${size}/${total}`);
  renameSync(part, dest);
  return dest;
}

/** A SPARQL result streamed to a TSV file; a query can't resume, so a failed attempt starts over. */
export async function sparqlTsv(endpoint: string, query: string, dest: string, log: (s: string) => void = console.log): Promise<string> {
  if (existsSync(dest)) return dest;
  mkdirSync(dirname(dest), { recursive: true });
  const part = `${dest}.part`;
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'User-Agent': UA, Accept: 'text/tab-separated-values', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ query }),
      });
      if (!res.ok || !res.body) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
      await pump(res, part, false);
      renameSync(part, dest);
      return dest;
    } catch (e) {
      log(`  retry ${attempt}/8 ${dest}: ${(e as Error).message}`);
      await sleep(backoff(attempt));
    }
  }
  throw new Error(`query failed: ${dest}`);
}
