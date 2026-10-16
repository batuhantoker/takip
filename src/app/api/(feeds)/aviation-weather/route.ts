import { NextResponse } from 'next/server';
import { gunzipSync } from 'node:zlib';
import { cachedSource } from '@/lib/core/net/source-cache';
import { TAKIP_USER_AGENT } from '@/lib/core/net/user-agent';
import { METAR_CACHE_URL, parseMetarCsv, type AirportWx } from '@/lib/feeds/aviation-weather/metar';
import { ISIGMET_URL, parseIsigmets, type Sigmet } from '@/lib/feeds/aviation-weather/sigmet';

/**
 * TAKIP — aviation weather from aviationweather.gov (NOAA, public domain).
 * `?kind=airports`: the latest METAR of every reporting station, with its flight category.
 * `?kind=sigmets`: international SIGMET hazard areas still in force.
 */

export const dynamic = 'force-dynamic';

// The upstream asks for no more than one request a minute per product.
const TTL_MS = 5 * 60_000;

async function fetchUpstream(url: string): Promise<Response> {
  const res = await fetch(url, { headers: { 'User-Agent': TAKIP_USER_AGENT }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`aviationweather.gov HTTP ${res.status}`);
  return res;
}

interface Airports { airports: AirportWx[]; updated: string | null }
interface Sigmets { sigmets: Sigmet[] }

const airports = cachedSource<Airports>('avwx:metars', async () => {
  const res = await fetchUpstream(METAR_CACHE_URL);
  const buf = Buffer.from(await res.arrayBuffer());
  // Served as octet-stream, so fetch leaves the gzip alone; a proxy might not.
  const text = (buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf) : buf).toString('utf8');
  const rows = parseMetarCsv(text);
  if (!rows.length) throw new Error('METAR cache: no stations');
  return [{ airports: rows, updated: res.headers.get('last-modified') }];
}, TTL_MS);

const sigmets = cachedSource<Sigmets>('avwx:isigmet', async () => {
  const res = await fetchUpstream(ISIGMET_URL);
  return [{ sigmets: parseIsigmets(await res.json()) }];
}, TTL_MS);

const HEADERS = { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' };

export async function GET(req: Request) {
  const kind = new URL(req.url).searchParams.get('kind');
  const timestamp = new Date().toISOString();
  if (kind === 'airports') {
    const [payload] = await airports();
    if (!payload) return NextResponse.json({ airports: [], error: 'aviationweather.gov METARs unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.json({ ...payload, timestamp }, { headers: HEADERS });
  }
  if (kind === 'sigmets') {
    const [payload] = await sigmets();
    if (!payload) return NextResponse.json({ sigmets: [], error: 'aviationweather.gov SIGMETs unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    // The cache can outlive a SIGMET's validity.
    const now = Date.now();
    return NextResponse.json({ sigmets: payload.sigmets.filter(s => Date.parse(s.to) > now), timestamp }, { headers: HEADERS });
  }
  return NextResponse.json({ error: 'kind must be airports or sigmets' }, { status: 400 });
}
