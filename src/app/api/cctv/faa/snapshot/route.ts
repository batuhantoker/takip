import { fetchLatestFaaImage } from '@/lib/cctv/sources/us/faa-weathercams';

export const runtime = 'nodejs';

/** FAA cameras shoot every ~10 minutes; a short cache keeps preview grids to one API call per camera. */
const TTL_MS = 2 * 60_000;
const MAX_ENTRIES = 2000;
const cache = new Map<number, { at: number; url: string }>();

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('id') || '';
  if (!/^\d{1,9}$/.test(raw)) return new Response('Invalid camera', { status: 400 });
  const id = Number(raw);

  const hit = cache.get(id);
  let url = hit && Date.now() - hit.at < TTL_MS ? hit.url : null;
  if (!url) {
    try {
      url = await fetchLatestFaaImage(id);
    } catch {
      return new Response('Snapshot unavailable', { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }
    if (!url) return new Response('Snapshot unavailable', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    cache.delete(id);
    cache.set(id, { at: Date.now(), url });
    if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  }

  return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'public, max-age=120' } });
}
