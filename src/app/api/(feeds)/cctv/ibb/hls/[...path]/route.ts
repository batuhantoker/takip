import { IBB_HLS_PATH, fetchIbbHls } from '@/lib/feeds/cameras/sources/turkey/ibb-hls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 25;

/** TAKIP — İBB traffic-camera HLS, relayed because most of the host's addresses refuse viewers outside Turkey. */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path.join('/');
  if (!IBB_HLS_PATH.test(path)) return new Response('Not found', { status: 404 });

  try {
    const { status, body } = await fetchIbbHls(path);
    if (status !== 200) {
      return new Response(null, { status: status >= 500 ? 502 : status, headers: { 'Cache-Control': 'no-store' } });
    }
    const playlist = path.endsWith('.m3u8');
    return new Response(new Uint8Array(body), {
      headers: {
        'Content-Type': playlist ? 'application/vnd.apple.mpegurl' : 'video/mp2t',
        'Cache-Control': playlist ? 'no-store' : 'public, max-age=60',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    console.warn(`[TAKIP] İBB HLS ${path}:`, e instanceof Error ? e.message : e);
    return new Response('Stream unreachable', { status: 504, headers: { 'Cache-Control': 'no-store' } });
  }
}
