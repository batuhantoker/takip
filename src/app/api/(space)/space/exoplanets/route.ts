import { NextResponse } from 'next/server';
import { cachedSource } from '@/lib/core/net/source-cache';
import { groupHosts, type ExoplanetPayload } from '@/lib/space/deep/exoplanets';

/**
 * TAKIP — every confirmed exoplanet with a known distance, by host star, from
 * the NASA Exoplanet Archive (keyless TAP, table pscomppars). Refreshed daily.
 */

export const maxDuration = 60;

const TAP = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';
const QUERY = 'select pl_name, hostname, ra, dec, sy_dist, sy_vmag, pl_orbper, pl_rade, pl_bmasse, disc_year, discoverymethod from pscomppars where sy_dist is not null';

const load = cachedSource<ExoplanetPayload>('space:exoplanets', async () => {
  const res = await fetch(`${TAP}?${new URLSearchParams({ query: QUERY, format: 'csv' })}`, { signal: AbortSignal.timeout(45_000) });
  if (!res.ok) throw new Error(`Exoplanet Archive HTTP ${res.status}`);
  const hosts = groupHosts(await res.text());
  return hosts.length ? [{ fetched: new Date().toISOString(), planets: hosts.reduce((n, h) => n + h.planets.length, 0), hosts }] : [];
}, 24 * 3_600_000);

export async function GET() {
  const [payload] = await load();
  if (!payload) return NextResponse.json({ error: 'NASA Exoplanet Archive unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json(payload, { headers: { 'Cache-Control': 'public, s-maxage=43200, stale-while-revalidate=86400' } });
}
