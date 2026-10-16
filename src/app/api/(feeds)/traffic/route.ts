import { NextResponse } from 'next/server';
import { cachedSource } from '@/lib/core/net/source-cache';
import { flowKey } from '@/lib/feeds/traffic/flow-tiles';
import { ndwSegments, NDW_BBOX } from '@/lib/feeds/traffic/sources/ndw';
import { ODS_CITIES, odsSegments } from '@/lib/feeds/traffic/sources/opendatasoft';
import { bboxOf, intersects, isTooWide, parseBbox, type Bbox, type TrafficResponse, type TrafficSegment, type TrafficSourceId } from '@/lib/feeds/traffic/types';
import { fetchNdwReadings, fetchOds, loadNdwSites } from '@/lib/feeds/traffic/upstream';

/**
 * TAKIP — measured road traffic in a view: `?bbox=w,s,e,n` (at most TRAFFIC_MAX_SPAN).
 * Only roads running slow or reported congested come back; free-flowing ones are not tinted.
 * Each provider is fetched only while someone looks at the area it covers.
 */

export const dynamic = 'force-dynamic';

interface Indexed { seg: TrafficSegment; box: Bbox }
interface Snapshot { segments: Indexed[] }

const index = (segments: TrafficSegment[]): Snapshot[] => [{ segments: segments.map(seg => ({ seg, box: bboxOf(seg.coords) })) }];

interface Provider { id: TrafficSourceId; bbox: Bbox; load: () => Promise<Snapshot[]> }

const PROVIDERS: Provider[] = [
  {
    id: 'ndw', bbox: [...NDW_BBOX],
    // NDW publishes every minute.
    load: cachedSource<Snapshot>('traffic:ndw', async () => {
      const sites = await loadNdwSites();
      if (!sites) throw new Error('NDW site geometry not built');
      return index(ndwSegments(await fetchNdwReadings(), sites));
    }, 90_000),
  },
  ...ODS_CITIES.map(city => ({
    id: city.id, bbox: city.bbox,
    load: cachedSource<Snapshot>(`traffic:${city.id}`, async () => index(odsSegments(city, await fetchOds(city))), 4 * 60_000),
  })),
];

/** A cached copy can outlive its readings when an upstream keeps failing. */
const MAX_AGE_MS = 20 * 60_000;

export async function GET(req: Request) {
  const bbox = parseBbox(new URL(req.url).searchParams.get('bbox'));
  if (!bbox) return NextResponse.json({ error: 'bbox=w,s,e,n required' }, { status: 400 });
  const timestamp = new Date().toISOString();
  const flow = !!flowKey();
  if (isTooWide(bbox)) return NextResponse.json({ segments: [], sources: [], flow, tooWide: true, timestamp } satisfies TrafficResponse);

  const covering = PROVIDERS.filter(p => intersects(p.bbox, bbox));
  const now = Date.now();
  const results = await Promise.all(covering.map(async p => {
    const [snap] = await p.load();
    return { id: p.id, ok: !!snap, segments: (snap?.segments ?? []).filter(s => intersects(s.box, bbox) && now - Date.parse(s.seg.at) < MAX_AGE_MS).map(s => s.seg) };
  }));
  const body: TrafficResponse = {
    segments: results.flatMap(r => r.segments),
    sources: results.map(({ id, ok }) => ({ id, ok })),
    flow,
    timestamp,
  };
  return NextResponse.json(body, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } });
}
