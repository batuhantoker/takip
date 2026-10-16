import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/core/net/ssrf-guard';
import { reconGate } from '@/lib/intel/recon/gate';
import { inspectHeaders } from '@/lib/intel/recon/network/web';

// Security-header grade — fetches the site through safeFetch (which blocks
// private targets and re-validates each redirect) and scores the protective
// response headers. Keyless.
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
    return NextResponse.json(await inspectHeaders(target));
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'unknown';
    const blocked = /blocked target|blocked protocol/.test(detail);
    return NextResponse.json({ error: blocked ? 'Target blocked' : 'Header check failed', detail }, { status: blocked ? 403 : 502 });
  }
}
