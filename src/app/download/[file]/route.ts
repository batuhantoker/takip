import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { downloadsDir, MIME, readDownloads } from '@/lib/platform/native/downloads';

/** The app files listed in latest.json, and nothing else from the folder. */
export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const listed = (await readDownloads())?.files.find(f => f.name === file);
  const full = listed && path.join(downloadsDir(), listed.name);
  const info = full ? await stat(full).catch(() => null) : null;
  if (!listed || !full || !info?.isFile()) return new Response('Not found', { status: 404 });
  // An hour, then a cheap check against the checksum: a rebuilt file under the same name reaches people within the hour.
  const cache = { ETag: `"${listed.sha256}"`, 'Cache-Control': 'public, max-age=3600' };
  if (request.headers.get('if-none-match') === cache.ETag) return new Response(null, { status: 304, headers: cache });
  return new Response(Readable.toWeb(createReadStream(full)) as ReadableStream, {
    headers: {
      ...cache,
      'Content-Type': MIME[listed.kind],
      'Content-Length': String(info.size),
      'Content-Disposition': `attachment; filename="${listed.name}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
