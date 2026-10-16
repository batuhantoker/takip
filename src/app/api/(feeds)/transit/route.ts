import { NextResponse } from 'next/server';
import { TRANSIT_FEEDS } from '@/lib/feeds/transit/catalog';
import { vehicleMode } from '@/lib/feeds/transit/gtfs/route-mode';
import { feedsInView, inBbox } from '@/lib/feeds/transit/select';
import { fetchVehicles } from '@/lib/feeds/transit/upstream';
import { isTooWide, parseBbox, type TransitFeedInfo, type TransitResponse, type TransitVehicle } from '@/lib/feeds/transit/view';
import { createFeedCache } from './feed-cache';

/**
 * TAKIP — live buses, trams and trains in one view (GTFS-RT vehicle positions, İETT).
 * Only the feeds whose area meets `bbox` are fetched, from at most MAX_FEEDS systems, and only
 * for a city-sized view. Takes a box, never a URL: upstreams come from the committed catalogue.
 */

export const dynamic = 'force-dynamic';

const MAX_FEEDS = 8;
const MAX_VEHICLES = 8_000;
/** A position older than this is history, not live (Entur keeps buses from hours ago). */
const MAX_AGE_S = 30 * 60;

// Long enough for Berlin's whole-network trip updates on a slow night; viewers are served the last answer meanwhile.
const cache = createFeedCache(fetchVehicles, { timeoutMs: 20_000 });

const round = (v: number) => Math.round(v * 1e5) / 1e5;

export async function GET(req: Request) {
  const view = parseBbox(new URL(req.url).searchParams.get('bbox'));
  if (!view) return NextResponse.json({ error: 'bbox=west,south,east,north is required' }, { status: 400 });
  const timestamp = new Date().toISOString();
  if (isTooWide(view)) {
    return NextResponse.json({ feeds: [], vehicles: [], skipped: 0, tooWide: true, timestamp } satisfies TransitResponse);
  }

  const { picked, skipped } = feedsInView(TRANSIT_FEEDS, view, MAX_FEEDS);
  const states = await Promise.all(picked.map(f => cache.get(f)));
  const nowS = Date.now() / 1000;
  const seen = new Set<string>();
  const vehicles: TransitVehicle[] = [];
  const feeds: TransitFeedInfo[] = picked.map((f, i) => {
    let count = 0;
    for (const v of states[i].vehicles) {
      if (vehicles.length >= MAX_VEHICLES) break;
      const age = v.t ? Math.max(0, Math.round(nowS - v.t)) : undefined;
      const key = `${f.id}:${v.id}`;
      if ((age ?? 0) > MAX_AGE_S || !inBbox(v.lng, v.lat, view) || seen.has(key)) continue;
      seen.add(key);
      vehicles.push({
        key, feed: i, lng: round(v.lng), lat: round(v.lat),
        bearing: v.bearing == null ? undefined : Math.round(v.bearing), speed: v.speed == null ? undefined : Math.round(v.speed * 10) / 10, route: v.line ?? v.route, trip: v.trip, label: v.label, plate: v.plate, operator: v.operator, status: v.status, age,
        mode: v.mode ?? vehicleMode(f, v.route), stop: v.stop, from: v.from, estimated: v.estimated || undefined, scheduled: v.scheduled || undefined,
      });
      count++;
    }
    return { id: f.id, name: f.name, license: f.license, ok: states[i].ok, count };
  });

  return NextResponse.json({ feeds, vehicles, skipped, timestamp } satisfies TransitResponse, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
