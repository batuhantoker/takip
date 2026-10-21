import { NextResponse } from 'next/server';
import { memoSource } from '@takip/connectors/advisories/source-memo';
import { TAKIP_USER_AGENT } from '@/lib/core/net/user-agent';
import { IODA_API, IODA_WINDOW_S, mapIodaEvents } from '@/lib/intel/outages/ioda';

export const dynamic = 'force-dynamic';

/** TAKIP — IODA country outage signals (lib/intel/outages/ioda), no key. */

async function loadOutages() {
  const until = Math.floor(Date.now() / 1000);
  const from = until - IODA_WINDOW_S;
  const res = await fetch(`${IODA_API}/outages/events?entityType=country&format=codf&limit=2000&from=${from}&until=${until}`, {
    signal: AbortSignal.timeout(30_000),
    cache: 'no-store',
    headers: { 'User-Agent': TAKIP_USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`IODA ${res.status}`);
  const json = (await res.json()) as { data?: unknown };
  if (!Array.isArray(json.data)) throw new Error('IODA: no event list');
  return mapIodaEvents(json.data, from, until);
}

// Held here as well as by s-maxage: nothing in front of the NUC caches /api (Cloudflare answers DYNAMIC).
const outagesMemo = memoSource(() => loadOutages().catch(error => {
  console.error('[TAKIP] IODA fetch error:', error);
  throw error;
}), 5 * 60_000, 60_000);

export async function GET() {
  const memo = await outagesMemo();
  if (!memo.loaded) {
    return NextResponse.json({ outages: [], total: 0, timestamp: new Date().toISOString(), source: 'IODA (offline)' });
  }
  return NextResponse.json({
    outages: memo.value,
    total: memo.value!.length,
    window_hours: IODA_WINDOW_S / 3600,
    timestamp: memo.fetchedAt,
    source: 'IODA — Georgia Tech Internet Outage Detection',
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
