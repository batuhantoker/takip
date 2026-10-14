import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';
import { reconGate } from '@/lib/recon/gate';
import { checkReputation } from '@/lib/recon/reputation';

// Reputation and threat intel for an IP or domain, merged from GreyNoise,
// abuse.ch Feodo, Spamhaus DROP, the Tor exit list and AlienVault OTX. Keyless.
export async function GET(req: Request) {
  const denied = await reconGate(req, 'network');
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const query = (searchParams.get('query') || '').trim();
  if (!query) return NextResponse.json({ error: 'Missing query parameter (IP or domain)' }, { status: 400 });

  if (isRateLimited(getClientIp(req), 20, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const report = await checkReputation(query);
    return NextResponse.json({ ...report, timestamp: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: 'Threat lookup failed', detail: e instanceof Error ? e.message : 'unknown' }, { status: 502 });
  }
}
