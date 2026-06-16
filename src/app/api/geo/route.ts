import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  // Get IP from headers
  let ip = req.headers.get('x-forwarded-for') || '';
  if (ip) {
    ip = ip.split(',')[0].trim();
  }
  
  // Use freeipapi (HTTPS enabled) to avoid backend fetch errors
  const url = (ip && ip !== '::1' && ip !== '127.0.0.1')
    ? `https://freeipapi.com/api/json/${ip}`
    : `https://freeipapi.com/api/json`;

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
