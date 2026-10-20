
import { NextResponse } from 'next/server';
import { httpJson } from '@/lib/core/net/http-json';
import { bcUrl, cwfisUrl, parseBcFires, parseCwfis, type FireIncident } from './cwfis';
import { memoSource } from '@takip/connectors/advisories/source-memo';
import { loadFirms } from './firms';

export const dynamic = 'force-dynamic';

/**
 * TAKIP — Active Fire & Wildfire Tracking
 * Multi-source: NASA FIRMS Open Data (primary for global fires; S-NPP, NOAA-20 and NOAA-21 VIIRS), NASA EONET (volcanoes),
 * and agency-reported Canadian wildfire incidents (CWFIS, with BC Wildfire names).
 */

const INCIDENTS_TTL_MS = 30 * 60_000;
let incidents: { at: number; rows: FireIncident[] } | null = null;
let incidentsInflight: Promise<FireIncident[]> | null = null;

/** Last good list on failure; an empty list is kept as-is, since a quiet winter has no fires. */
async function loadIncidents(): Promise<FireIncident[]> {
  if (incidents && Date.now() - incidents.at < INCIDENTS_TTL_MS) return incidents.rows;
  incidentsInflight ??= (async () => {
    try {
      const [cwfis, bc] = await Promise.all([
        httpJson<unknown>(cwfisUrl(new Date()), { timeoutMs: 30_000 }),
        httpJson<unknown>(bcUrl(), { timeoutMs: 30_000 }).then(parseBcFires, () => undefined),
      ]);
      incidents = { at: Date.now(), rows: parseCwfis(cwfis, bc) };
    } catch (e) {
      console.warn('[TAKIP] CWFIS incidents failed:', e instanceof Error ? e.message : e);
      if (!incidents) return [];
    } finally {
      incidentsInflight = null;
    }
    return incidents!.rows;
  })();
  return incidentsInflight;
}

async function loadVolcanoes(): Promise<any[]> {
  const volcRes = await fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=volcanoes&limit=50', {
    signal: AbortSignal.timeout(10000),
  });
  if (!volcRes.ok) throw new Error(`EONET ${volcRes.status}`);
  const volcData = await volcRes.json();
  return (volcData.events || []).map((e: any) => {
    const geo = e.geometry?.[e.geometry.length - 1];
    if (!geo?.coordinates) return null;
    return {
      lat: geo.coordinates[1],
      lng: geo.coordinates[0],
      brightness: 500,
      confidence: 'high',
      date: geo.date?.split('T')[0] || '',
      time: '',
      frp: 100,
      title: `[VOLCANO] ${e.title}`,
      type: 'volcano',
    };
  }).filter(Boolean);
}

// EONET takes about 3 s and nothing in front of the NUC caches /api (Cloudflare answers DYNAMIC); the route promises 10 minutes.
const volcanoMemo = memoSource(() => loadVolcanoes().catch(e => {
  console.warn('[TAKIP] Suppressed EONET error:', e instanceof Error ? e.message : e);
  throw e;
}), 10 * 60_000, 2 * 60_000);

export async function GET() {
  try {
    const incidentsPromise = loadIncidents();

    // NASA FIRMS Open Data: the three VIIRS satellites merged, no key (./firms.ts).
    const firms = await loadFirms();
    let fires: any[] = firms.rows;
    let source = firms.source;

    // Source 2: Pull volcanoes from EONET for richer data
    const volcanoes = await volcanoMemo();
    if (volcanoes.loaded) {
      fires = [...fires, ...volcanoes.value!];
      if (!source) source = 'NASA-EONET';
    }

    return NextResponse.json({
      fires,
      fire_incidents: await incidentsPromise,
      total: fires.length,
      source: source || 'Unknown',
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
      },
    });
  } catch (error) {
    console.error('Fire fetch error:', error);
    return NextResponse.json({ fires: [], error: 'Failed to fetch fire data' }, { status: 500 });
  }
}
