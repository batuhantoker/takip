import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  // Get the REAL client IP — check multiple header sources
  // Cloudflare sets cf-connecting-ip, proxies set x-forwarded-for, x-real-ip
  let ip = 
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '';

  // On localhost, these headers are empty — fall back to fetching without IP
  // which returns the machine's own public IP (correct for local dev)
  // On production behind Cloudflare, cf-connecting-ip is the USER's real IP
  const isLocal = !ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.');
  
  const url = isLocal
    ? `https://freeipapi.com/api/json`
    : `https://freeipapi.com/api/json/${ip}`;

  try {
    const res = await fetch(url);
    
    if (!res.ok) {
      throw new Error(`Geo API returned ${res.status}`);
    }
    
    const data = await res.json();
    
    // Map freeipapi schema back to the old ip-api schema so frontend stays exactly the same
    const mapped = {
      status: 'success',
      lat: data.latitude,
      lon: data.longitude,
      city: data.cityName,
      regionName: data.regionName,
      country: data.countryName,
      query: data.ipAddress,
      isp: data.asnOrganization,
      org: data.asnOrganization,
      as: data.asn ? `AS${data.asn} ${data.asnOrganization}` : ''
    };
    
    return NextResponse.json(mapped);
  } catch (error) {
    console.error('Geo API error:', error);
    return NextResponse.json({ error: 'Failed to geolocate' }, { status: 500 });
  }
}
