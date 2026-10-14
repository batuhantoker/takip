import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';
import { reconGate } from '@/lib/recon/gate';
import { findVulnerabilities } from '@/lib/recon/vuln';

export const maxDuration = 60;

// Known vulnerabilities — resolves the host, reads Shodan InternetDB's recorded
// CVEs for it, and enriches each with CVSS, EPSS and CISA KEV. Keyless.
export async function GET(req: Request) {
  const denied = await reconGate(req, 'scan');
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const target = (searchParams.get('target') || searchParams.get('host') || '').trim();
  if (!target) return NextResponse.json({ error: 'Missing target parameter' }, { status: 400 });

  if (isRateLimited(`vuln:${getClientIp(req)}`, 6, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const host = target.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
  try {
    const report = await findVulnerabilities(host);
    if (report.error) return NextResponse.json(report, { status: 422 });
    return NextResponse.json(report, { headers: { 'Cache-Control': 'private, max-age=300' } });
  } catch (e) {
    return NextResponse.json({ error: 'Vulnerability lookup failed', detail: e instanceof Error ? e.message : 'unknown' }, { status: 502 });
  }
}
