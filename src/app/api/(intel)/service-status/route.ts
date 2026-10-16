import { NextResponse } from 'next/server';
import { cachedSource } from '@/lib/core/net/source-cache';
import { VENDORS, degradedByCity, mapSummary, type VendorStatus } from './statuspage';

/** TAKIP — vendor status pages (./statuspage), read together every 5 minutes. */

interface Payload { vendors: VendorStatus[]; unavailable: string[] }

const load = cachedSource<Payload>('service-status:statuspage', async () => {
  const results = await Promise.allSettled(VENDORS.map(async v => {
    const res = await fetch(`https://${v.host}/api/v2/summary.json`, {
      headers: { 'User-Agent': 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)', Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`${v.name} HTTP ${res.status}`);
    return mapSummary(v, await res.json());
  }));
  const vendors = results.flatMap(r => (r.status === 'fulfilled' ? [r.value] : []));
  if (!vendors.length) throw new Error('no status page answered');
  const unavailable = VENDORS.filter((_, i) => results[i].status === 'rejected').map(v => v.name);
  return [{ vendors, unavailable }];
}, 5 * 60_000);

export async function GET() {
  const [payload] = await load();
  if (!payload) {
    return NextResponse.json({ vendors: [], cities: [], error: 'No status page answered' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({
    ...payload,
    cities: degradedByCity(payload.vendors),
    timestamp: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300' } });
}
