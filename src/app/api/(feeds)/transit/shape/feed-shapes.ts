import { shapePoints, tripShapeId, type Zipped } from '@/lib/feeds/transit/gtfs/shapes';
import type { TransitFeed } from '@/lib/feeds/transit/select';
import type { LngLat } from '@/lib/feeds/transit/placement/snap';
import { openZip } from '@/lib/core/net/remote-zip';
import { memo, staticFiles } from '../static-files';

// As the zip stores them. The Netherlands' national feed (78 MB of shapes) is past this and goes without.
const MAX_SHAPES_BYTES = 64 * 1024 * 1024;
const MAX_TRIPS_BYTES = 24 * 1024 * 1024;

interface Files { trips: Zipped; shapes: Zipped }

/** The feed's trips.txt and shapes.txt, still compressed; a tracked vehicle needs one feed's. */
const feedFiles = staticFiles<Files>('shapes', 3, async feed => {
  if (!feed.static) return null;
  const zip = await openZip(feed.static, AbortSignal.timeout(90_000));
  const trips = zip.find('trips.txt'), shapes = zip.find('shapes.txt');
  if (!trips || !shapes || trips.size > MAX_TRIPS_BYTES || shapes.size > MAX_SHAPES_BYTES) return null;
  const [t, s] = await Promise.all([zip.raw(trips), zip.raw(shapes)]);
  return { trips: { data: t, method: trips.method }, shapes: { data: s, method: shapes.method } };
});

const tripShapes = memo<LngLat[] | null>(2_000);

/** The shape a trip runs along, or null when the feed has none for it. */
export function tripShape(feed: TransitFeed, tripId: string): Promise<LngLat[] | null> {
  return tripShapes(`${feed.id}|${tripId}`, async () => {
    const f = await feedFiles(feed);
    const shapeId = f && await tripShapeId(f.trips, tripId);
    const pts = f && shapeId ? await shapePoints(f.shapes, shapeId) : [];
    return pts.length > 1 ? pts : null;
  }).catch(() => null);
}
