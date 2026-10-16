import { NextResponse } from 'next/server';
import { loadNhcForecast } from '../nhc-forecast';

export const dynamic = 'force-dynamic';

/** NHC forecast cones, tracks and points for the active storms, as one GeoJSON FeatureCollection. */
export async function GET() {
  const features = await loadNhcForecast();
  return NextResponse.json({ type: 'FeatureCollection', features, timestamp: new Date().toISOString() }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
