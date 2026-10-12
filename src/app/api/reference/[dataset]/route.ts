import { NextResponse } from 'next/server';
import { WORLD, parseBbox } from '@/lib/reference/bbox';
import { referenceDataset } from '@/lib/reference/catalog';
import { createFileStore } from '@/lib/reference/file-store';

/** A hard cap per response; `truncated` tells the client it hit it. */
export const MAX_FEATURES = 20_000;

/**
 * GET /api/reference/{dataset}?bbox=west,south,east,north&zoom=z
 *
 * The dataset's features that touch the box, as a GeoJSON FeatureCollection
 * with `matched` and `truncated` alongside. Below the dataset's minZoom the
 * collection is empty, and some datasets serve only their major features at
 * low zoom (see `tiers` in lib/reference/catalog).
 */
export async function GET(req: Request, { params }: { params: Promise<{ dataset: string }> }) {
  const dataset = referenceDataset((await params).dataset);
  if (!dataset) return NextResponse.json({ error: 'Unknown dataset' }, { status: 404 });

  const search = new URL(req.url).searchParams;
  const boxes = parseBbox(search.get('bbox') ?? WORLD.join(','));
  if (!boxes) return NextResponse.json({ error: 'bbox must be west,south,east,north' }, { status: 400 });
  const zoom = search.has('zoom') ? Number(search.get('zoom')) : dataset.minZoom;
  if (!Number.isFinite(zoom) || zoom < 0 || zoom > 24) {
    return NextResponse.json({ error: 'zoom must be between 0 and 24' }, { status: 400 });
  }

  const store = createFileStore();
  const info = await store.stat(dataset.id);
  if (!info) return NextResponse.json({ error: `${dataset.label} is not installed on this server` }, { status: 503 });

  // The data only changes when the files are refreshed, so the version is a sound ETag for any query.
  const etag = `W/"${info.version}"`;
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=600, stale-while-revalidate=86400',
    ETag: etag,
  };
  if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });

  if (zoom < dataset.minZoom) {
    return new Response(JSON.stringify({ type: 'FeatureCollection', features: [], matched: 0, truncated: false, minZoom: dataset.minZoom }), { headers });
  }

  try {
    const { features, matched } = await store.query(dataset, { boxes, zoom, limit: MAX_FEATURES });
    // Features are spliced in as stored rather than parsed and re-serialised.
    const body = `{"type":"FeatureCollection","features":[${features.join(',')}],"matched":${matched},"truncated":${matched > features.length}}`;
    return new Response(body, { headers });
  } catch (err) {
    console.error(`[reference] ${dataset.id} query failed:`, err);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }
}
