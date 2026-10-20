/* HTTP and output paths shared by the fetch scripts. */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { RAW_MORE } from './context';

export const UA = 'TAKIP-history-import/0.1 (https://takip.dev; hello@takip.dev)';

export async function get(url: string, init: RequestInit = {}): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...init.headers } }).catch(e => {
      if (attempt >= 4) throw e;
      return null;
    });
    if (res?.ok) return res;
    if (res && (attempt >= 4 || (res.status !== 429 && res.status < 500))) throw new Error(`${res.status} ${url}`);
    await new Promise(r => setTimeout(r, 5000 * attempt));
  }
}

export const out = (dir: string, file: string) => {
  mkdirSync(join(RAW_MORE, dir), { recursive: true });
  return join(RAW_MORE, dir, file);
};
