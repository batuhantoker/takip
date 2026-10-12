import { TS_BASE, extractTrafficScotlandFrame } from '@/lib/cctv/sources/europe/traffic-scotland';

export const runtime = 'nodejs';

/** A Traffic Scotland camera's current frame, decoded from its HTML fragment. Takes a camera sid, never a URL. */
export async function GET(request: Request) {
  const sid = new URL(request.url).searchParams.get('sid') ?? '';
  if (!/^\d{1,6}$/.test(sid)) return new Response('Invalid camera', { status: 400 });
  try {
    const response = await fetch(`${TS_BASE}/camerahtml?sid=${sid}`, {
      headers: { 'User-Agent': 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)' },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 60 },
    });
    if (!response.ok) throw new Error(`Traffic Scotland HTTP ${response.status}`);
    const image = extractTrafficScotlandFrame(await response.text());
    if (!image) return new Response('Frame unavailable', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    return new Response(new Uint8Array(image), {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=60', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch {
    return new Response('Frame unavailable', { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
