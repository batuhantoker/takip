import { NextResponse } from 'next/server';
import { cachedSource } from '@/lib/core/net/source-cache';
import { AQ_CITIES, mapOpenMeteoAq, openMeteoAqUrl, type AqReading } from './open-meteo';

/**
 * TAKIP — Air Quality API
 * Modelled current air quality (CAMS) for ~50 major cities from Open-Meteo, in one request (./open-meteo).
 * OpenAQ v2, used before, has answered 410 Gone since its v1/v2 retirement; v3 needs a key.
 */

const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';

// CAMS updates hourly; half an hour keeps any reading under ~1.5 h old.
const load = cachedSource<AqReading>('air-quality:open-meteo', async () => {
  const res = await fetch(openMeteoAqUrl(AQ_CITIES), {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Open-Meteo AQ HTTP ${res.status}`);
  return mapOpenMeteoAq(await res.json(), AQ_CITIES);
}, 30 * 60_000);

export async function GET() {
  const stations = await load();
  if (!stations.length) {
    return NextResponse.json({ stations: [], error: 'Failed to fetch air quality data' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({
    stations,
    total: stations.length,
    kind: 'modelled',
    source: 'Open-Meteo (CAMS)',
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=1800' },
  });
}
