import sharp from 'sharp';
import { safeFetch } from '@/lib/ssrf-guard';
import { BROWSER_UA } from './extract';
import { dhashFromPixels } from './photo-hash';

const MAX_BYTES = 3 * 1024 * 1024;

async function readCapped(res: Response, max: number): Promise<Buffer | null> {
  if (!res.body) return null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** Avatar URLs come from the profiles themselves, so they go through the SSRF guard and a size cap. */
export async function avatarHash(url: string, opts: { timeoutMs: number; signal?: AbortSignal }): Promise<string | null> {
  try {
    const signal = opts.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(opts.timeoutMs)]) : AbortSignal.timeout(opts.timeoutMs);
    const res = await safeFetch(url, { signal, headers: { 'User-Agent': BROWSER_UA, Accept: 'image/*' } });
    if (!res.ok || !/^image\//i.test(res.headers.get('content-type') || '')) return null;
    const buf = await readCapped(res, MAX_BYTES);
    if (!buf) return null;
    const px = await sharp(buf, { limitInputPixels: 4096 * 4096 })
      .flatten({ background: '#ffffff' })
      .grayscale()
      .resize(9, 8, { fit: 'fill' })
      .raw()
      .toBuffer();
    return dhashFromPixels(px);
  } catch {
    return null;
  }
}
