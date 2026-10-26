import { NextResponse } from 'next/server';
import { cachedSource } from '@/lib/core/net/source-cache';
import { fetchPhotos, type Photo } from '@/lib/places/attractions/photos';

const MAX_IDS = 60;
const DAY_MS = 86_400_000;

/**
 * GET /api/things-to-do/photos?ids=Q19675,Q2981
 *
 * Each item's Wikimedia Commons picture with its author and licence (lib/places/attractions/photos.ts), by Wikidata
 * id; items without a free picture are left out. The place pages ask for their own items' over loopback.
 */
export async function GET(req: Request) {
  const ids = [...new Set((new URL(req.url).searchParams.get('ids') ?? '').split(',').map(s => s.trim()).filter(s => /^Q\d{1,10}$/.test(s)))].sort();
  if (!ids.length || ids.length > MAX_IDS) return NextResponse.json({ error: `ids: 1 to ${MAX_IDS} Wikidata ids` }, { status: 400 });
  try {
    const [photos] = await cachedSource<Record<string, Photo>>(`things-to-do:photos:${ids.join(',')}`, async () => [await fetchPhotos(ids)], 7 * DAY_MS)();
    return NextResponse.json({ photos: photos ?? {} }, { headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' } });
  } catch (err) {
    console.error('[things-to-do] photos failed:', err);
    return NextResponse.json({ error: 'Wikimedia lookup failed' }, { status: 502 });
  }
}
