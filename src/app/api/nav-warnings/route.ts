import { NextResponse } from 'next/server';
import { cachedSource } from '@/lib/sourceCache';
import { httpJson } from '@/lib/httpJson';
import { NGA_BROADCAST_WARN_URL, parseBroadcastWarn, toNavWarnings } from './nga-msi';

/**
 * TAKIP — NGA MSI broadcast navigational warnings placed on the map. `total` counts placed warnings;
 * `unplaced` counts in-force warnings whose text carries no position (mostly in-force lists and cancellations).
 */

const loadWarnings = cachedSource(
  'nav-warnings:nga-msi',
  async () => parseBroadcastWarn(await httpJson<unknown>(NGA_BROADCAST_WARN_URL, { timeoutMs: 30_000 })),
  60 * 60_000,
);

/** NGA stopped issuing through this API in 2024-05; a set this old must never read as current. */
const STALE_AFTER_MS = 30 * 24 * 3_600_000;

export async function GET() {
  const { warnings, unplaced } = toNavWarnings(await loadWarnings());
  const latestIssued = warnings.map(w => w.issued).filter((t): t is string => !!t).sort().at(-1) ?? null;
  return NextResponse.json({
    warnings,
    total: warnings.length,
    unplaced,
    latestIssued,
    stale: !latestIssued || Date.now() - Date.parse(latestIssued) > STALE_AFTER_MS,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
  });
}
