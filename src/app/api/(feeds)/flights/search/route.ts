import { NextResponse, type NextRequest } from 'next/server';
import { searchFlights } from '@/lib/feeds/aviation/flight-search';
import { latestFlights } from '../latest';

export const dynamic = 'force-dynamic';

/** Older than this and the feed is asked again; it refreshes every 90 s while anyone has the map open. */
const STALE_MS = 3 * 60_000;

const num = (v: string | null) => (v === null || v.trim() === '' ? NaN : Number(v));

/**
 * Aircraft in the latest worldwide snapshot matching `q`: a callsign, flight number, registration, ICAO 24-bit
 * address or airline name. `lat`/`lng` put the nearest first among equal matches.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const q = (params.get('q') ?? '').slice(0, 64);
  const limit = Math.min(25, Math.max(1, Math.round(num(params.get('limit'))) || 8));
  const lat = num(params.get('lat')), lng = num(params.get('lng'));
  const near = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;

  let snapshot = latestFlights();
  if (!snapshot || Date.now() - snapshot.at > STALE_MS) {
    // Answering builds and publishes a new snapshot; the body itself isn't needed.
    try {
      const res = await fetch(`${new URL(req.url).origin}/api/flights`, { signal: AbortSignal.timeout(30_000) });
      await res.body?.cancel();
    } catch { /* search what there is */ }
    snapshot = latestFlights() ?? snapshot;
  }
  if (!snapshot) return NextResponse.json({ error: 'The flights feed is not available' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });

  const { hits, total } = searchFlights(snapshot.data, q, { limit, near });
  return NextResponse.json({ results: hits, total, at: new Date(snapshot.at).toISOString() }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
