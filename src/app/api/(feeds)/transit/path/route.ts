import { NextResponse } from 'next/server';
import { TRANSIT_FEEDS } from '@/lib/feeds/transit/catalog';
import { isRoadFeed } from '@/lib/feeds/transit/select';
import { metres, pathLength, type LngLat } from '@/lib/feeds/transit/placement/snap';
import { TAKIP_USER_AGENT } from '@/lib/core/net/user-agent';

/**
 * TAKIP — the roads a bus took between two fixes, for feeds without route shapes (İETT).
 * Road-only feeds and short hops only: OSRM's public demo asks for at most one request a second.
 */

export const dynamic = 'force-dynamic';

const OSRM = 'https://router.project-osrm.org/route/v1/driving';
const GAP_MS = 1_100;
const MIN_HOP_M = 25;
const MAX_HOP_M = 5_000;
const MAX_CACHED = 1_000;

const cache = new Map<string, LngLat[] | null>();
let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;

const point = (raw: string | null): LngLat | null => {
  const [lng, lat] = (raw ?? '').split(',').map(Number);
  return Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lng) <= 180 && Math.abs(lat) <= 90 ? [lng, lat] : null;
};

async function route(a: LngLat, b: LngLat): Promise<LngLat[] | null> {
  const wait = lastCall + GAP_MS - Date.now();
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastCall = Date.now();
  const res = await fetch(`${OSRM}/${a.join(',')};${b.join(',')}?overview=full&geometries=geojson`, {
    headers: { 'User-Agent': TAKIP_USER_AGENT }, signal: AbortSignal.timeout(6_000), cache: 'no-store',
  });
  if (!res.ok) return null;
  const coords = ((await res.json()) as { routes?: { geometry?: { coordinates?: LngLat[] } }[] }).routes?.[0]?.geometry?.coordinates;
  // A road route far longer than the hop went round a block the bus didn't: keep the straight line.
  return coords && coords.length > 1 && pathLength(coords) <= 2.5 * metres(a, b) + 300 ? coords : null;
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const feed = TRANSIT_FEEDS.find(f => f.id === q.get('feed'));
  const a = point(q.get('from')), b = point(q.get('to'));
  if (!feed || !a || !b) return NextResponse.json({ error: 'feed, from and to are required' }, { status: 400 });
  const hop = metres(a, b);
  if (!isRoadFeed(feed) || hop < MIN_HOP_M || hop > MAX_HOP_M) return NextResponse.json({ path: null });

  const key = [...a, ...b].map(v => v.toFixed(5)).join(',');
  if (!cache.has(key)) {
    const call = queue.then(() => route(a, b)).catch(() => null);
    queue = call;
    cache.set(key, await call);
    while (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
  }
  return NextResponse.json({ path: cache.get(key) ?? null }, { headers: { 'Cache-Control': 'no-store' } });
}
