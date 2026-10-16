import { createFlowTiles, flowKey } from '@/lib/feeds/traffic/flow-tiles';
import { isTileAddress } from '@/lib/feeds/traffic/sources/tomtom';
import { TRAFFIC_REFRESH_MS } from '@/lib/feeds/traffic/types';

/**
 * TAKIP — one TomTom traffic flow vector tile, so the key stays on the server.
 * No key, over the day's budget or a failed upstream → 204, which the map draws as an empty tile.
 */

export const dynamic = 'force-dynamic';

let tiles: { key: string; get: ReturnType<typeof createFlowTiles> } | null = null;

export async function GET(_req: Request, { params }: { params: Promise<{ z: string; x: string; y: string }> }) {
  const { z, x, y } = await params;
  const [zi, xi, yi] = [z, x, y].map(Number);
  if (!isTileAddress(zi, xi, yi)) return new Response(null, { status: 404 });
  const key = flowKey();
  if (!key) return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  if (tiles?.key !== key) tiles = { key, get: createFlowTiles(key) };

  const body = await tiles.get(zi, xi, yi);
  if (!body) return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  return new Response(body, {
    headers: { 'Content-Type': 'application/x-protobuf', 'Cache-Control': `public, max-age=${TRAFFIC_REFRESH_MS / 1000}` },
  });
}
