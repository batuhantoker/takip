import { NextResponse } from 'next/server';
import { loadPerimeters } from '../wfigs';

export const dynamic = 'force-dynamic';

/** US wildfire perimeters from NIFC WFIGS, as one GeoJSON FeatureCollection. */
export async function GET() {
  const features = await loadPerimeters();
  return NextResponse.json({ type: 'FeatureCollection', features, timestamp: new Date().toISOString() }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
