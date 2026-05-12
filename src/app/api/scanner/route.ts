import { NextResponse } from 'next/server';

// Proxy to Osiris Scanner backend on Proxmox
// API key is server-side only — never exposed to client
const SCANNER_URL = process.env.SCANNER_URL || 'http://100.68.100.15:7700';
const SCANNER_KEY = process.env.SCANNER_KEY || '';

export async function GET(req: Request) {
  if (!SCANNER_KEY) {
    return NextResponse.json({ error: 'Scanner not configured', hint: 'Set SCANNER_URL and SCANNER_KEY in .env' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const target = searchParams.get('target');
  const scanType = searchParams.get('type') || 'quick';
  const port = searchParams.get('port');
  const ports = searchParams.get('ports');

  if (!target) {
    return NextResponse.json({ error: 'Missing target parameter' }, { status: 400 });
  }

  // Map scan types to scanner endpoints
  const endpointMap: Record<string, string> = {
    quick: '/scan/quick',
    ports: '/scan/ports',
    banner: '/scan/banner',
    ssl: '/scan/ssl',
    traceroute: '/scan/traceroute',
    rdns: '/scan/rdns',
    headers: '/scan/headers',
  };

  const endpoint = endpointMap[scanType];
  if (!endpoint) {
    return NextResponse.json({ error: 'Invalid scan type', valid: Object.keys(endpointMap) }, { status: 400 });
  }

  try {
    const params = new URLSearchParams({ key: SCANNER_KEY, target });
    if (port) params.set('port', port);
    if (ports) params.set('ports', ports);

    const res = await fetch(`${SCANNER_URL}${endpoint}?${params.toString()}`, {
      signal: AbortSignal.timeout(50000),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ 
      error: 'Scanner unreachable', 
      detail: e.message,
      hint: 'Ensure scanner is running on Proxmox' 
    }, { status: 502 });
  }
}
