import { NextResponse } from 'next/server';
import { TRANSIT_FEEDS } from '@/lib/feeds/transit/catalog';
import { isRoadFeed } from '@/lib/feeds/transit/select';
import { tripShape } from './feed-shapes';

/**
 * TAKIP — the shape a tracked vehicle's trip runs along, from its feed's static GTFS, so the
 * vehicle moves along its route between fixes. `road` says whether a road route is the fallback.
 */

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const feed = TRANSIT_FEEDS.find(f => f.id === q.get('feed'));
  if (!feed) return NextResponse.json({ error: 'unknown feed' }, { status: 404 });
  const trip = q.get('trip')?.slice(0, 200);
  const shape = trip ? await tripShape(feed, trip) : null;
  return NextResponse.json({ shape, road: isRoadFeed(feed) }, {
    headers: { 'Cache-Control': shape ? 'private, max-age=3600' : 'no-store' },
  });
}
