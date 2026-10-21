import { NextResponse } from 'next/server';
import { liveFeeds } from '@/lib/intel/alerts/live-tv-status';

/**
 * TAKIP — Live News Feeds: the channels in lib/intel/alerts/live-tv, each with
 * the broadcast it is showing now (live-tv-status). The Live TV menu reads it too.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  const feeds = await liveFeeds();
  return NextResponse.json({
    feeds,
    total: feeds.length,
    live: feeds.filter(f => f.live).length,
    categories: ['mainstream', 'finance', 'state', 'conflict'],
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
