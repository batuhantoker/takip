import { NextResponse, type NextRequest } from 'next/server';
import { NEARBY_NM, loadNearby } from '../nearby';

export const dynamic = 'force-dynamic';

/** Aircraft within 250 nm of `lat`/`lon`, seconds old, from adsb.lol (ODbL). */
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get('lat'));
  const lon = Number(req.nextUrl.searchParams.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90) {
    return NextResponse.json({ error: 'lat and lon are required' }, { status: 400 });
  }
  const { anchor, rows, at, stale } = await loadNearby(lat, lon);
  return NextResponse.json({ anchor, radius_nm: NEARBY_NM, flights: rows, at: at && new Date(at).toISOString(), stale }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
