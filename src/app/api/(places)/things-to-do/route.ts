import { NextResponse } from 'next/server';
import { isLocale } from '@/lib/core/i18n/locales';
import { parseBbox } from '@/lib/feeds/reference/bbox';
import { spotsIn, spotsVersion } from '@/lib/places/attractions/store';

/**
 * GET /api/things-to-do?bbox=west,south,east,north&zoom=z&lang=xx
 *
 * Museums, castles, parks and landmarks in the box (lib/places/attractions) as a GeoJSON FeatureCollection, the best
 * known first, thinned to what fits at `zoom` and named in `lang` (English by default), with `truncated` alongside.
 */
export async function GET(req: Request) {
  const search = new URL(req.url).searchParams;
  const boxes = parseBbox(search.get('bbox') ?? '');
  if (!boxes) return NextResponse.json({ error: 'bbox must be west,south,east,north' }, { status: 400 });
  const zoom = Number(search.get('zoom'));
  if (!search.has('zoom') || !Number.isFinite(zoom) || zoom < 0 || zoom > 24) {
    return NextResponse.json({ error: 'zoom must be between 0 and 24' }, { status: 400 });
  }
  const lang = search.get('lang') ?? 'en';
  if (!isLocale(lang)) return NextResponse.json({ error: 'Unknown lang' }, { status: 400 });

  // The data only changes when the builder runs, so its version is a sound ETag for any query.
  const etag = `W/"${spotsVersion()}"`;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400', ETag: etag };
  if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
  try {
    return new Response(JSON.stringify(spotsIn(boxes, zoom, lang)), { headers });
  } catch (err) {
    console.error('[things-to-do] query failed:', err);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }
}
