import type { Zipped } from '@/lib/feeds/transit/gtfs/shapes';
import { stopPlaces, tripStopIds, type StopPlaces } from '@/lib/feeds/transit/gtfs/stops';
import type { TransitFeed } from '@/lib/feeds/transit/select';
import type { TransitStop } from '@/lib/feeds/transit/view';
import { openZip } from '@/lib/core/net/remote-zip';
import { memo, staticFiles } from '../static-files';

// As the zip stores them: a trip at the far end of a 48 MB stop_times.txt (Helsinki) is a 0.8 s scan.
// Toronto (67 MB), Warsaw (88 MB) and the Netherlands (126 MB) are past this and go without stops.
const MAX_STOP_TIMES_BYTES = 64 * 1024 * 1024;
const MAX_STOPS_BYTES = 8 * 1024 * 1024;

interface Files { stopTimes: Zipped; places: StopPlaces }

const feedFiles = staticFiles<Files>('stops', 2, async feed => {
  if (!feed.static) return null;
  const zip = await openZip(feed.static, AbortSignal.timeout(90_000));
  const times = zip.find('stop_times.txt'), stops = zip.find('stops.txt');
  if (!times || !stops || times.size > MAX_STOP_TIMES_BYTES || stops.size > MAX_STOPS_BYTES) return null;
  const [t, s] = await Promise.all([zip.raw(times), zip.raw(stops)]);
  return { stopTimes: { data: t, method: times.method }, places: await stopPlaces({ data: s, method: stops.method }) };
});

const tripStopLists = memo<TransitStop[] | null>(2_000);

/** The stops a trip calls at, in order, or null when the feed doesn't say. */
export function tripStops(feed: TransitFeed, tripId: string): Promise<TransitStop[] | null> {
  return tripStopLists(`${feed.id}|${tripId}`, async () => {
    const f = await feedFiles(feed);
    if (!f) return null;
    const stops = (await tripStopIds(f.stopTimes, tripId)).map(id => f.places.get(id)).filter(s => s != null);
    return stops.length > 1 ? stops : null;
  }).catch(() => null);
}
