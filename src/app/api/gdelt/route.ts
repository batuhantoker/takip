import { NextResponse } from 'next/server';

/**
 * OSIRIS — GDELT Conflict Events API
 * Fetches global conflict/protest events from GDELT Project
 */

export async function GET() {
  try {
    // GDELT GKG 2.0 — last 24h events with conflict themes
    const url = 'https://api.gdeltproject.org/api/v2/geo/geo?query=conflict%20OR%20protest%20OR%20military%20OR%20attack&mode=PointData&format=GeoJSON&timespan=24h&maxpoints=500';
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      next: { revalidate: 600 }, // Cache 10 min
    });

    if (!res.ok) {
      return NextResponse.json({ events: [], error: 'GDELT unavailable' });
    }

    const data = await res.json();
    const features = data.features || [];

    const events = features.map((f: any, i: number) => ({
      id: `gdelt-${i}`,
      lat: f.geometry?.coordinates?.[1],
      lng: f.geometry?.coordinates?.[0],
      name: f.properties?.name || 'Unknown Event',
      url: f.properties?.url || '',
      html: f.properties?.html || '',
      shareimage: f.properties?.shareimage || '',
      type: 'conflict',
    })).filter((e: any) => e.lat != null && e.lng != null);

    return NextResponse.json({
      events,
      total: events.length,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
      },
    });
  } catch (error) {
    console.error('GDELT fetch error:', error);
    return NextResponse.json({ events: [], error: 'Failed to fetch GDELT data' }, { status: 500 });
  }
}
