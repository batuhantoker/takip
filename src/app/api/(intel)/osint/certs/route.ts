import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/core/net/ssrf-guard';
import { reconGate } from '@/lib/intel/recon/gate';

type CrtRow = { id: string | number; issuer_name: string; common_name: string; name_value: string; not_before: string; not_after: string; serial_number: string };
type CertspotterRow = { id: string; dns_names?: string[]; issuer?: { name?: string; friendly_name?: string }; not_before: string; not_after: string; cert_sha256?: string };

// Certificate Transparency lookup via crt.sh, with Cert Spotter when crt.sh is down (both keyless)
export async function GET(req: Request) {
  const denied = await reconGate(req, 'network');
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get('domain');
  if (!domain) return NextResponse.json({ error: 'Missing domain parameter' }, { status: 400 });

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 20, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
    return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 });
  }

  try {
    let certs: CrtRow[] = [];
    try {
      const res = await fetch(`https://crt.sh/?q=%25.${encodeURIComponent(domain)}&output=json`, {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'TAKIP-OSINT/0.1' },
      });
      if (res.ok) certs = await res.json();
    } catch { /* crt.sh is often busy; fall back to certspotter below */ }

    // crt.sh down or empty → certspotter's CT view, mapped to the same shape.
    if (!certs.length) {
      const cs = await fetch(
        `https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(domain)}&include_subdomains=true&expand=dns_names&expand=issuer&expand=not_before&expand=not_after`,
        { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'TAKIP-OSINT/0.1', Accept: 'application/json' } },
      );
      if (cs.ok) {
        const rows: CertspotterRow[] = await cs.json();
        certs = rows.map(r => ({
          id: r.id,
          issuer_name: r.issuer?.name || r.issuer?.friendly_name || '',
          common_name: (r.dns_names || [])[0] || '',
          name_value: (r.dns_names || []).join('\n'),
          not_before: r.not_before,
          not_after: r.not_after,
          serial_number: r.cert_sha256?.slice(0, 16) || r.id,
        }));
      }
    }

    if (!certs.length) {
      return NextResponse.json({ domain, certificates: [], subdomains: [], error: 'crt.sh unavailable' });
    }

    // Deduplicate by common name and extract subdomains
    const seen = new Set<string>();
    const subdomains = new Set<string>();
    const uniqueCerts = [];

    for (const cert of certs.slice(0, 200)) {
      const key = `${cert.common_name}-${cert.serial_number}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Extract subdomains
      const name = cert.name_value || '';
      name.split('\n').forEach((n: string) => {
        const clean = n.trim().replace(/^\*\./, '');
        if (clean.endsWith(domain)) subdomains.add(clean);
      });

      uniqueCerts.push({
        id: cert.id,
        issuer: cert.issuer_name,
        common_name: cert.common_name,
        name_value: cert.name_value,
        not_before: cert.not_before,
        not_after: cert.not_after,
        serial: cert.serial_number,
      });
    }

    return NextResponse.json({
      domain,
      certificates: uniqueCerts.slice(0, 50),
      subdomains: Array.from(subdomains).sort(),
      total_certs: certs.length,
      unique_subdomains: subdomains.size,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ domain, certificates: [], subdomains: [], error: 'Lookup failed' }, { status: 500 });
  }
}
