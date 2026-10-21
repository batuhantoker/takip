import { liveImageByFile, type LiveImageInfo } from '@/lib/platform/site/live-images';
import { latestPicture } from './latest';

/** /live/<file>.jpg, the latest picture, and /live/<file>.json, when it was taken (lib/platform/site/live-images.ts). */

export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const m = /^([a-z0-9-]+)\.(jpg|json)$/.exec((await params).file);
  const id = m && liveImageByFile(m[1]);
  if (!m || !id) return new Response('Not found', { status: 404 });
  const pic = await latestPicture(id);
  if (!pic) return new Response('Not available yet', { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '120' } });
  const headers = { 'Cache-Control': 'public, max-age=600, stale-while-revalidate=3600', 'Last-Modified': new Date(pic.taken).toUTCString() };
  if (m[2] === 'json') return Response.json({ taken: pic.taken } satisfies LiveImageInfo, { headers });
  return new Response(new Uint8Array(pic.jpeg), { headers: { ...headers, 'Content-Type': 'image/jpeg' } });
}
