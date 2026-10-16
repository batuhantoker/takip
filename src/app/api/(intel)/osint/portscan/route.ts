import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/core/net/ssrf-guard';
import { reconGate } from '@/lib/intel/recon/gate';
import { scanPorts } from '@/lib/intel/recon/network/portscan';

export const maxDuration = 30;

// Live TCP-connect scan of the common ports. validateHost (inside scanPorts)
// keeps it off private and reserved ranges. Keyless; only scan hosts you may test.
export async function GET(req: Request) {
  const denied = await reconGate(req, 'scan');
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const target = (searchParams.get('target') || searchParams.get('host') || '').trim();
  if (!target) return NextResponse.json({ error: 'Missing target parameter' }, { status: 400 });

  // Stricter than the passive lookups: a scan opens real sockets.
  if (isRateLimited(`portscan:${getClientIp(req)}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const host = target.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
  const report = await scanPorts(host);
  if (report.error) {
    return NextResponse.json({ error: 'Target blocked', detail: report.error }, { status: 403 });
  }
  return NextResponse.json(report);
}
