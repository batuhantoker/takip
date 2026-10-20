import { NextResponse } from 'next/server';
import { LIVE_CHANNELS, liveEmbedUrl } from '@/lib/intel/alerts/live-tv';

/**
 * TAKIP — Live News Feeds: the channels in lib/intel/alerts/live-tv, each with
 * an embeddable player. The Live TV menu reads the same table.
 */

export async function GET() {
  const feeds = LIVE_CHANNELS.map(c => ({
    id: c.id,
    name: c.name,
    city: c.city,
    country: c.country,
    lat: c.lat,
    lng: c.lng,
    url: liveEmbedUrl(c),
    embed_allowed: true,
    category: c.category,
    language: c.language,
    region: c.region,
  }));
  return NextResponse.json({
    feeds,
    total: feeds.length,
    categories: ['mainstream', 'finance', 'state', 'conflict'],
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' },
  });
}
