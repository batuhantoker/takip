import { join } from 'node:path';

export type Codec = 'zstd' | 'gzip';

export const EXT: Record<Codec, string> = { zstd: '.ndjson.zst', gzip: '.ndjson.gz' };

export const HOUR_MS = 3_600_000;

const SOURCE_RE = /^[a-z0-9_][a-z0-9_.-]*$/;

/** Source codes become directory names, so they are restricted to a safe alphabet. */
export function assertSource(src: string) {
  if (!SOURCE_RE.test(src)) throw new Error(`invalid archive source: ${JSON.stringify(src)}`);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `{dir}/raw/{src}/YYYY/MM/DD/HH{ext}` for the UTC hour containing `t`. */
export function hourFile(dir: string, src: string, t: number, codec: Codec): string {
  assertSource(src);
  const d = new Date(t);
  return join(dir, 'raw', src, String(d.getUTCFullYear()), pad(d.getUTCMonth() + 1), pad(d.getUTCDate()), `${pad(d.getUTCHours())}${EXT[codec]}`);
}

/** Query parameters that commonly carry credentials (Ontario and Alberta 511 put keys in the URL). */
const SECRET_PARAM = /key|token|secret|password|passwd|sig|auth/i;

export function stripKeys(url: string): string {
  try {
    const u = new URL(url);
    for (const name of [...u.searchParams.keys()]) {
      if (SECRET_PARAM.test(name)) u.searchParams.delete(name);
    }
    u.username = '';
    u.password = '';
    return u.toString();
  } catch {
    return url;
  }
}
