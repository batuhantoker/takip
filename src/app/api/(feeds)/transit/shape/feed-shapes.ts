import { shapePoints, tripShapeId, type Zipped } from '@/lib/feeds/transit/gtfs/shapes';
import type { TransitFeed } from '@/lib/feeds/transit/select';
import type { LngLat } from '@/lib/feeds/transit/placement/snap';
import { openZip } from '@/lib/core/net/remote-zip';

// As the zip stores them. The Netherlands' national feed (78 MB of shapes) is past this and goes without.
const MAX_SHAPES_BYTES = 64 * 1024 * 1024;
const MAX_TRIPS_BYTES = 24 * 1024 * 1024;
/** Feeds whose files are held at once; a tracked vehicle needs one. */
const MAX_FEEDS = 3;
const RETRY_MS = 10 * 60_000;
const MAX_RESULTS = 2_000;

interface Files { trips: Zipped; shapes: Zipped }

const files = new Map<string, Promise<Files | null>>();
const failed = new Map<string, number>();
const tripShapes = new Map<string, Promise<LngLat[] | null>>();

async function load(feed: TransitFeed): Promise<Files | null> {
  if (!feed.static) return null;
  const zip = await openZip(feed.static, AbortSignal.timeout(90_000));
  const trips = zip.find('trips.txt'), shapes = zip.find('shapes.txt');
  if (!trips || !shapes || trips.size > MAX_TRIPS_BYTES || shapes.size > MAX_SHAPES_BYTES) return null;
  const [t, s] = await Promise.all([zip.raw(trips), zip.raw(shapes)]);
  return { trips: { data: t, method: trips.method }, shapes: { data: s, method: shapes.method } };
}

/** The feed's trips.txt and shapes.txt, still compressed; the least recently used feed is let go. */
function feedFiles(feed: TransitFeed): Promise<Files | null> {
  const hit = files.get(feed.id);
  if (hit) {
    files.delete(feed.id);
    files.set(feed.id, hit);
    return hit;
  }
  if (Date.now() - (failed.get(feed.id) ?? 0) < RETRY_MS) return Promise.resolve(null);
  const p = load(feed).catch(err => {
    console.warn(`[TAKIP] transit shapes for ${feed.id}: ${err instanceof Error ? err.message : String(err)}`);
    failed.set(feed.id, Date.now());
    files.delete(feed.id);
    return null;
  });
  files.set(feed.id, p);
  while (files.size > MAX_FEEDS) files.delete(files.keys().next().value!);
  return p;
}

/** The shape a trip runs along, or null when the feed has none for it. */
export function tripShape(feed: TransitFeed, tripId: string): Promise<LngLat[] | null> {
  const key = `${feed.id}|${tripId}`;
  let hit = tripShapes.get(key);
  if (!hit) {
    hit = (async () => {
      const f = await feedFiles(feed);
      const shapeId = f && await tripShapeId(f.trips, tripId);
      const pts = f && shapeId ? await shapePoints(f.shapes, shapeId) : [];
      return pts.length > 1 ? pts : null;
    })().catch(() => null);
    tripShapes.set(key, hit);
    while (tripShapes.size > MAX_RESULTS) tripShapes.delete(tripShapes.keys().next().value!);
  }
  return hit;
}
