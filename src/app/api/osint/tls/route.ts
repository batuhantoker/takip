import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';
import { reconGate } from '@/lib/recon/gate';
import { inspectTls } from '@/lib/recon/tls';

// TLS inspection — opens a real handshake to the host and reports the
// negotiated protocol, cipher and leaf certificate. Keyless.
export async function GET(req: Request) {
  const denied = await reconGate(req, 'network');
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get('domain') || searchParams.get('host') || '').trim();
  if (!raw) return NextResponse.json({ error: 'Missing domain parameter' }, { status: 400 });

  if (isRateLimited(getClientIp(req), 20, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const host = raw.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
  const port = Number(raw.match(/:(\d+)/)?.[1] ?? 443);

  const report = await inspectTls(host, Number.isInteger(port) && port > 0 && port < 65536 ? port : 443);
  if (!report.ok && report.error) {
    return NextResponse.json({ error: 'TLS check failed', detail: report.error, ...report }, { status: 502 });
  }
  return NextResponse.json(report);
}
