import { NextResponse } from 'next/server';
import { cachedSource } from '@/lib/core/net/source-cache';
import {
  EMSC_LIMIT, USGS_URL, emscUrl, mapEmscQuake, mapUsgsQuake, mergeCatalogues, parseFeatures,
  type EmscFeature, type Quake, type UsgsFeature,
} from './catalog';

/**
 * TAKIP — Earthquake Data API
 * The last 24 h at M2.5+ from USGS and EMSC, twins folded together (see ./catalog).
 * No API key required.
 */

const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';

interface SourceStatus {
  ok: boolean;
  count: number;
  /** The upstream page was full, so the count is a floor. */
  capped?: boolean;
}

interface Payload {
  earthquakes: Quake[];
  twins: number;
  sources: { USGS: SourceStatus; EMSC: SourceStatus };
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res.json();
}

function rowsOf<T>(res: PromiseSettledResult<unknown>, label: string): T[] | null {
  try {
    if (res.status === 'rejected') throw res.reason;
    return parseFeatures<T>(res.value, label);
  } catch (error) {
    console.warn(`[TAKIP] ${label} earthquakes unavailable:`, error instanceof Error ? error.message : error);
    return null;
  }
}

async function collect(): Promise<Payload[]> {
  const [usgsRes, emscRes] = await Promise.allSettled([getJson(USGS_URL), getJson(emscUrl(Date.now()))]);

  const usgsRows = rowsOf<UsgsFeature>(usgsRes, 'USGS');
  const emscRows = rowsOf<EmscFeature>(emscRes, 'EMSC');
  // Throwing keeps the last good list in the cache instead of an empty map.
  if (!usgsRows && !emscRows) throw new Error('no earthquake catalogue answered');

  const usgs = (usgsRows ?? []).map(mapUsgsQuake).filter((q): q is Quake => q !== null);
  const emsc = (emscRows ?? []).map(mapEmscQuake).filter((q): q is Quake => q !== null);
  const { quakes, twins } = mergeCatalogues(usgs, emsc);
  return [{
    earthquakes: quakes,
    twins,
    sources: {
      USGS: { ok: usgsRows !== null, count: usgs.length },
      EMSC: { ok: emscRows !== null, count: emsc.length, capped: (emscRows?.length ?? 0) >= EMSC_LIMIT },
    },
  }];
}

const load = cachedSource<Payload>('earthquakes:merged', collect, 60_000);

export async function GET() {
  try {
    const [payload] = await load();
    if (!payload) throw new Error('no earthquake data');
    return NextResponse.json({
      ...payload,
      total: payload.earthquakes.length,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('Earthquake fetch error:', error);
    return NextResponse.json({ earthquakes: [], error: 'Failed to fetch earthquake data' }, { status: 500 });
  }
}
