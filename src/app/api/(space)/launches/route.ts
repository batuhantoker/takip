import { NextResponse } from 'next/server';
import { cachedSource } from '@/lib/core/net/source-cache';
import { LL2_URLS, parseLl2, type Launch } from './ll2';

/**
 * TAKIP — upcoming launches at their pads (Launch Library 2, see ./ll2).
 * One upstream read an hour at most, whoever asks.
 */

const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
const HOUR_MS = 3600_000;
// sourceCache retries a cold failure after a minute; LL2's anonymous quota needs a longer pause.
const FAILURE_HOLD_MS = 15 * 60_000;
let holdUntil = 0;

interface Payload {
  launches: Launch[];
  /** LL2's own count of upcoming launches; `launches` holds the soonest 50. */
  upcoming: number | null;
  mirror: 'll' | 'lldev';
}

export async function collect(): Promise<Payload[]> {
  if (Date.now() < holdUntil) throw new Error('LL2 on hold after a failed read');
  let lastError: unknown;
  for (const [i, url] of LL2_URLS.entries()) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`LL2 HTTP ${res.status}`);
      const json = await res.json();
      const launches = parseLl2(json);
      if (!launches.length) throw new Error('LL2 returned no upcoming launches');
      const upcoming = typeof json?.count === 'number' ? json.count : null;
      return [{ launches, upcoming, mirror: i === 0 ? 'll' : 'lldev' }];
    } catch (e) {
      lastError = e;
    }
  }
  holdUntil = Date.now() + FAILURE_HOLD_MS;
  throw lastError;
}

const load = cachedSource<Payload>('launches:ll2', collect, HOUR_MS);

export async function GET() {
  const [payload] = await load();
  if (!payload) {
    return NextResponse.json({ launches: [], error: 'Launch Library 2 unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({
    ...payload,
    total: payload.launches.length,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=1800' },
  });
}
