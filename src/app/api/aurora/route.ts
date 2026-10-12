import { NextResponse } from 'next/server';
import { cachedSource } from '@/lib/sourceCache';
import { OVATION_URL, parseOvation, type AuroraGrid } from './ovation';

/** TAKIP — the aurora nowcast as the map draws it (./ovation). SWPC refreshes it about every 5 minutes. */

const load = cachedSource<AuroraGrid>('aurora:ovation', async () => {
  const res = await fetch(OVATION_URL, {
    headers: { 'User-Agent': 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)', Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`OVATION HTTP ${res.status}`);
  return [parseOvation(await res.json())];
}, 5 * 60_000);

export async function GET() {
  const [grid] = await load();
  if (!grid) {
    return NextResponse.json({ cells: [], error: 'NOAA OVATION unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({ ...grid, total: grid.cells.length, timestamp: new Date().toISOString() }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300' },
  });
}
