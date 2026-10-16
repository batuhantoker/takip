import { fetchTopisStreamUrl } from '@/lib/feeds/cameras/sources/asia/seoul-topis';

export const runtime = 'nodejs';

/** A camera's playlist URL is fixed per channel, so one lookup serves every viewer for hours. */
const TTL_MS = 6 * 60 * 60_000;
const MAX_ENTRIES = 1000;
const cache = new Map<string, { at: number; url: string }>();

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!/^\d{1,6}$/.test(id)) return new Response('Invalid camera', { status: 400 });

  const hit = cache.get(id);
  let url = hit && Date.now() - hit.at < TTL_MS ? hit.url : null;
  if (!url) {
    try {
      url = await fetchTopisStreamUrl(id);
    } catch {
      return new Response('Stream unavailable', { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }
    if (!url) return new Response('Stream unavailable', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    cache.delete(id);
    cache.set(id, { at: Date.now(), url });
    if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  }

  return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'public, max-age=3600' } });
}
