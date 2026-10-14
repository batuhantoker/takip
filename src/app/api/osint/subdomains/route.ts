import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';
import { reconGate } from '@/lib/recon/gate';
import { enumerateSubdomains } from '@/lib/recon/subdomains';

export const maxDuration = 30;

// Subdomain enumeration — crt.sh + certspotter + hackertarget, merged. No key.
export async function GET(req: Request) {
  const denied = await reconGate(req, 'network');
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const domain = (searchParams.get('domain') || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!domain) return NextResponse.json({ error: 'Missing domain parameter' }, { status: 400 });
  if (!/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 });
  }

  if (isRateLimited(getClientIp(req), 15, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const report = await enumerateSubdomains(domain);
    if (!report.sources.some(s => s.ok)) {
      return NextResponse.json({ ...report, error: 'Every source failed to answer. Try again in a minute.' }, { status: 502 });
    }
    return NextResponse.json(report, { headers: { 'Cache-Control': 'private, max-age=300' } });
  } catch (e) {
    return NextResponse.json({ error: 'Subdomain lookup failed', detail: e instanceof Error ? e.message : 'unknown' }, { status: 502 });
  }
}
