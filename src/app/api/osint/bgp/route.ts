import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';
import { reconGate } from '@/lib/recon/gate';

// BGP / ASN intelligence via RIPEstat (keyless). For an IP: its announced
// prefix, origin ASN and geolocation. For an ASN: holder, announced prefix
// counts and upstream/downstream peers.
const UA = { Accept: 'application/json', 'User-Agent': 'TAKIP-Recon' };
const ripe = (path: string, resource: string) =>
  fetch(`https://stat.ripe.net/data/${path}/data.json?resource=${encodeURIComponent(resource)}`, { signal: AbortSignal.timeout(8000), headers: UA });

/** The PTR name for an IPv4 address, via Google's resolver; null when there is none. */
async function reverseDns(ip: string): Promise<string | null> {
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return null;
  const name = `${ip.split('.').reverse().join('.')}.in-addr.arpa`;
  try {
    const res = await fetch(`https://dns.google/resolve?name=${name}&type=PTR`, { signal: AbortSignal.timeout(5000), headers: UA });
    const d = await res.json();
    const answer = (d.Answer ?? []).find((a: { type: number }) => a.type === 12)?.data;
    return answer ? String(answer).replace(/\.$/, '') : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const denied = await reconGate(req, 'network');
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get('query') || '').trim();
  if (!query) return NextResponse.json({ error: 'Missing query parameter (IP, ASN number, or prefix)' }, { status: 400 });

  if (isRateLimited(getClientIp(req), 20, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(query) || /^[0-9a-f:]+:[0-9a-f:]*$/i.test(query);
  const asnNum = /^(AS)?\d+$/i.test(query) ? query.replace(/^AS/i, '') : null;

  try {
    const results: Record<string, unknown> = { query, timestamp: new Date().toISOString() };

    if (isIP) {
      const [prefixRes, geoRes, ptr] = await Promise.all([ripe('prefix-overview', query), ripe('maxmind-geo-lite', query), reverseDns(query)]);
      const prefix = prefixRes.ok ? (await prefixRes.json()).data : null;
      const origin = prefix?.asns?.[0];
      let country: string | null = null;
      if (geoRes.ok) {
        const located = (await geoRes.json()).data?.located_resources?.[0]?.locations?.[0];
        country = located?.country ?? null;
      }
      // holder reads "GOOGLE - Google LLC"; split the handle from the name.
      const [handle, ...rest] = String(origin?.holder ?? '').split(/\s+-\s+/);
      results.type = 'ip';
      results.registry = prefix?.block?.desc ?? null;
      results.ip = {
        asn: {
          asn: origin?.asn ?? 'N/A',
          name: rest.length ? rest.join(' - ') : handle || 'N/A',
          description: handle && rest.length ? handle : 'N/A',
          country_code: country ?? 'N/A',
        },
        prefix: prefix?.resource ?? 'N/A',
        announced: prefix?.announced ?? null,
        ptr_record: ptr ?? 'N/A',
      };
    } else if (asnNum) {
      const [overviewRes, prefixesRes, neighboursRes, countryRes] = await Promise.all([
        ripe('as-overview', `AS${asnNum}`),
        ripe('announced-prefixes', `AS${asnNum}`),
        ripe('asn-neighbours', `AS${asnNum}`),
        ripe('rir-stats-country', `AS${asnNum}`),
      ]);
      const country: string | null = countryRes.ok ? ((await countryRes.json()).data?.located_resources?.[0]?.location ?? null) : null;
      const overview = overviewRes.ok ? (await overviewRes.json()).data : null;
      const prefixes: { prefix: string }[] = prefixesRes.ok ? ((await prefixesRes.json()).data?.prefixes ?? []) : [];
      const neighbours: { asn: number; type: string }[] = neighboursRes.ok ? ((await neighboursRes.json()).data?.neighbours ?? []) : [];

      const v4 = prefixes.filter(p => p.prefix.includes('.'));
      const v6 = prefixes.filter(p => p.prefix.includes(':'));
      const upstream = neighbours.filter(n => n.type === 'left').map(n => n.asn);
      const downstream = neighbours.filter(n => n.type === 'right').map(n => n.asn);
      const [handle, ...rest] = String(overview?.holder ?? '').split(/\s+-\s+/);

      results.type = 'asn';
      results.registry = overview?.block?.desc ?? null;
      results.asn = {
        asn: parseInt(asnNum, 10),
        name: rest.length ? rest.join(' - ') : handle || 'N/A',
        description: handle && rest.length ? handle : (overview?.holder ?? 'N/A'),
        country_code: country ?? 'N/A',
        announced: overview?.announced ?? null,
      };
      results.prefixes = {
        ipv4: v4.slice(0, 20).map(p => p.prefix),
        ipv6: v6.slice(0, 20).map(p => p.prefix),
        total_v4: v4.length,
        total_v6: v6.length,
      };
      results.peers = { upstream: upstream.slice(0, 20), downstream: downstream.slice(0, 20), total: neighbours.length };
    } else {
      return NextResponse.json({ error: 'Unrecognized query format. Use IP address or AS number.' }, { status: 400 });
    }

    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: 'BGP lookup failed' }, { status: 500 });
  }
}
