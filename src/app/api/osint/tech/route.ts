import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';
import { reconGate } from '@/lib/recon/gate';
import { fingerprintTech } from '@/lib/recon/web-probe';

// Tech fingerprint — reads only what a site actually emits (response headers,
// cookies, generator meta and well-known markup), not a guesswork database.
export async function GET(req: Request) {
  const denied = await reconGate(req, 'network');
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const target = (searchParams.get('url') || searchParams.get('domain') || '').trim();
  if (!target) return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });

  if (isRateLimited(getClientIp(req), 20, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    return NextResponse.json(await fingerprintTech(target));
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'unknown';
    const blocked = /blocked target|blocked protocol/.test(detail);
    return NextResponse.json({ error: blocked ? 'Target blocked' : 'Tech lookup failed', detail }, { status: blocked ? 403 : 502 });
  }
}
