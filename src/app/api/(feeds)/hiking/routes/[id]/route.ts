import { NextResponse } from 'next/server';
import { slimDetails, type RouteDetails } from '@/lib/feeds/hiking/details';
import { WMT_API } from '@/lib/feeds/hiking/overlay';
import { httpJson } from '@/lib/core/net/http-json';
import { cachedSource } from '@/lib/core/net/source-cache';

export const maxDuration = 20;

const TTL_MS = 6 * 3600_000;

/**
 * GET /api/hiking/routes/{id}
 *
 * One Waymarked Trails route (an OSM relation id) without its geometry, for
 * the map's route popup. Names follow the caller's language.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d{1,12}$/.test(id)) return NextResponse.json({ error: 'id must be an OSM relation id' }, { status: 400 });
  const primary = (req.headers.get('accept-language') ?? '').split(/[,;-]/)[0].trim().toLowerCase();
  const lang = /^[a-z]{2,3}$/.test(primary) ? primary : 'en';

  const [details] = await cachedSource<RouteDetails>(`hiking:${id}:${lang}`, async () => {
    const raw = await httpJson<unknown>(`${WMT_API}/details/relation/${id}`, { timeoutMs: 15_000, headers: { 'Accept-Language': lang } });
    const slim = slimDetails(raw);
    return slim ? [slim] : [];
  }, TTL_MS)();

  if (!details) return NextResponse.json({ error: 'Route unavailable' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json(details, { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400', Vary: 'Accept-Language' } });
}
