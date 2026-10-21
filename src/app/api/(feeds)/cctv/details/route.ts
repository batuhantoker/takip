import { NextResponse } from 'next/server';
import { ensureRestored, rebuildPayload } from '@/lib/feeds/cameras/catalog/refresh';
import { getPayload } from '@/lib/feeds/cameras/catalog/snapshot';
import { DETAILS_MAX_IDS } from '@/lib/feeds/cameras/pins';

/**
 * The full records of the cameras the map's pins name: ?id=a&id=b, up to DETAILS_MAX_IDS. Repeated params, not a list:
 * some ids hold commas. An id the catalogue doesn't hold is left out.
 */
export async function GET(request: Request) {
  await ensureRestored();
  const ids = [...new Set(new URL(request.url).searchParams.getAll('id'))].slice(0, DETAILS_MAX_IDS);
  const ready = getPayload() ?? rebuildPayload();
  const cameras = ids.flatMap(id => ready?.byId.get(id) ?? []);
  return NextResponse.json({ cameras }, {
    headers: { 'Cache-Control': ready?.complete ? 'public, max-age=300, stale-while-revalidate=3600' : 'no-store' },
  });
}
