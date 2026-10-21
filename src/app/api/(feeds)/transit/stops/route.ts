import { NextResponse } from 'next/server';
import { TRANSIT_FEEDS } from '@/lib/feeds/transit/catalog';
import { TIMETABLES } from '@/lib/feeds/transit/generated/schedules.generated';
import { patternStops } from '@/lib/feeds/transit/placement/scheduled';
import { tripStops } from './feed-stops';

/**
 * TAKIP — the stops a tracked vehicle's trip calls at, in order, from its feed's static GTFS
 * (stop_times.txt) or, for a metro run from its timetable, the timetable's stations.
 */

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const feed = TRANSIT_FEEDS.find(f => f.id === q.get('feed'));
  const trip = q.get('trip')?.slice(0, 200);
  if (!feed || !trip) return NextResponse.json({ error: 'feed and trip are required' }, { status: 400 });
  const stops = feed.kind === 'scheduled' ? patternStops(TIMETABLES[feed.id], trip) : await tripStops(feed, trip);
  return NextResponse.json({ stops }, {
    headers: { 'Cache-Control': stops ? 'private, max-age=3600' : 'no-store' },
  });
}
