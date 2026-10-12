import { NextResponse } from 'next/server';
import { getPayload } from '@/lib/cctv-snapshot';

export const maxDuration = 60;
import { getRegionsForBounds } from './catalog-bounds';
import {
  ALL_REGIONS,
  PAYLOAD_REFRESH_MS,
  REGION_FETCHERS,
  collectRegions,
  ensureRestored,
  persistCatalogue,
  rebuildInBackground,
  rebuildPayload,
} from './catalog-refresh';
import { servePayload } from './catalog-response';

export { warmCctvCatalog, clearCctvRefreshes } from './catalog-refresh';

/**
 * OSIRIS — Worldwide CCTV Camera API v2
 * Viewport-aware: pass ?region=xx to load cameras for specific regions
 * Supports: uk, us-east, us-west, us-central, canada, europe, asia
 * Or pass ?lat=x&lng=y&radius=5 for proximity-based loading
 */

export async function GET(request: Request) {
  try {
    await ensureRestored();
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region');
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');
    const radius = parseFloat(searchParams.get('radius') || '10');

    let regionsToFetch: string[];

    if (region === 'all') {
      regionsToFetch = Object.keys(REGION_FETCHERS);
    } else if (region) {
      regionsToFetch = region.split(',').filter(r => r in REGION_FETCHERS);
    } else if (lat !== 0 || lng !== 0) {
      regionsToFetch = getRegionsForBounds(lat, lng, radius);
    } else {
      // Default: load all regions for global coverage
      regionsToFetch = Object.keys(REGION_FETCHERS);
    }

    if (regionsToFetch.length === ALL_REGIONS().length) {
      const ready = getPayload();
      if (ready) {
        void persistCatalogue();
        // Past its TTL, refresh behind the response rather than in front of it.
        /* An incomplete catalogue is chased straight away; a complete one is
           left alone until its regions actually go stale. */
        if (!ready.complete || Date.now() - ready.builtAt > PAYLOAD_REFRESH_MS) void rebuildInBackground();
        return servePayload(request, ready);
      }
    }

    const collected = await collectRegions(regionsToFetch);

    const allCameras: any[] = [];
    const sources: Record<string, number> = {};
    const pendingRegions = collected.pending;

    for (const region of regionsToFetch) {
      for (const cam of collected.cameras[region] ?? []) {
        allCameras.push(cam);
        sources[cam.source] = (sources[cam.source] || 0) + 1;
      }
    }

    /* Cache what was just assembled, so the next caller is served the
       prebuilt bytes instead of paying to build them again — and so the
       catalogue reaches disk even when no payload existed to begin with. */
    if (regionsToFetch.length === ALL_REGIONS().length) {
      const built = rebuildPayload();
      if (built) {
        void persistCatalogue();
        return servePayload(request, built);
      }
    }

    const cacheControl = pendingRegions.length > 0 || allCameras.length < 50
      ? 'no-store, max-age=0' 
      : 'public, s-maxage=300, stale-while-revalidate=600';

    return NextResponse.json({
      cameras: allCameras,
      total: allCameras.length,
      sources,
      regions: regionsToFetch,
      pendingRegions,
      timestamp: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': cacheControl },
    });
  } catch (error) {
    console.error('CCTV fetch error:', error);
    return NextResponse.json({ cameras: [], error: 'Failed' }, { status: 500 });
  }
}
