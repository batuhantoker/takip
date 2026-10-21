import { NextResponse } from 'next/server';
import { visitorIp } from '@/lib/core/net/ssrf-guard';
import { askProviders } from '@/lib/places/ip-location/ask-providers';
import { pickConsensus } from '@/lib/places/ip-location/consensus';
import { fromCloudflare } from '@/lib/places/ip-location/providers';

/* The answer is one visitor's location. No cache, shared or otherwise, may
   hand it to the next visitor. */
const NO_STORE = { 'Cache-Control': 'private, no-store' };

/* Server-side so HTTPS pages can use HTTP-only providers. Every provider is
   asked at once and the answer most of them agree on wins: any one of them
   can be hundreds of kilometres off for a given address. `tz` (the browser's
   zone) drops answers from a zone with another offset. */
export async function GET(request: Request) {
  const ip = visitorIp(request);

  /* No public address means the proxy chain lost the visitor's. Asking the
     providers without one locates this server instead, which would fly
     every such visitor to the server's city. Only in development, where the
     server is the developer's own machine, is that the right answer. */
  if (!ip && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ status: 'fail', message: 'Visitor address unknown' }, { headers: NO_STORE });
  }

  const candidates = [...fromCloudflare(request.headers), ...(await askProviders(ip))];
  const best = pickConsensus(candidates, new URL(request.url).searchParams.get('tz'));
  if (!best) return NextResponse.json({ error: 'All geolocation providers failed' }, { status: 502, headers: NO_STORE });

  return NextResponse.json({
    status: 'success',
    query: ip ?? best.query ?? 'auto',
    lat: best.lat,
    lon: best.lon,
    city: best.city ?? 'Unknown',
    regionName: best.regionName ?? 'Unknown',
    country: best.country ?? 'Unknown',
    isp: best.isp ?? 'Unknown',
    org: best.org ?? 'Unknown',
    as: best.as ?? 'Unknown',
    agreement: best.agreement,
    answered: best.answered,
  }, { headers: NO_STORE });
}
