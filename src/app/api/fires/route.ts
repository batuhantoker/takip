import { NextResponse } from 'next/server';

/**
 * OSIRIS — NASA FIRMS Active Fire Tracking
 * Real-time worldwide wildfire/fire detection from NASA satellites
 * Multiple fallback sources for reliability
 */

export async function GET() {
  try {
    // Source 1: NASA FIRMS VIIRS (primary)
    const firmsKey = 'd0a624db1bff890120a9bc74e81e4e46';
    const sources = [
      `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${firmsKey}/VIIRS_SNPP_NRT/world/1`,
      `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${firmsKey}/MODIS_NRT/world/1`,
      `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${firmsKey}/VIIRS_NOAA20_NRT/world/1`,
    ];

    let fires: any[] = [];
    let source = '';

    for (const url of sources) {
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(20000),
          headers: { 'User-Agent': 'OSIRIS-Intelligence-Platform/3.4' },
        });
        if (res.ok) {
          const text = await res.text();
          if (text && text.includes('latitude') && text.length > 100) {
            fires = parseCSV(text);
            source = url.includes('VIIRS_SNPP') ? 'VIIRS-SNPP' : url.includes('MODIS') ? 'MODIS' : 'VIIRS-NOAA20';
            break;
          }
        }
      } catch { continue; }
    }

    // Source 2: Fallback to NASA EONET for active natural events (fires + volcanic)
    if (fires.length === 0) {
      try {
        const eonetRes = await fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=wildfires&limit=200', {
          signal: AbortSignal.timeout(15000),
        });
        if (eonetRes.ok) {
          const eonetData = await eonetRes.json();
          fires = (eonetData.events || []).map((e: any) => {
            const geo = e.geometry?.[e.geometry.length - 1];
            return {
              lat: geo?.coordinates?.[1] || 0,
              lng: geo?.coordinates?.[0] || 0,
              brightness: 350,
              confidence: 'high',
              date: geo?.date?.split('T')[0] || '',
              time: '',
              frp: 50,
              title: e.title,
            };
          }).filter((f: any) => f.lat !== 0);
          source = 'NASA-EONET';
        }
      } catch {}
    }

    return NextResponse.json({
      fires,
      total: fires.length,
      source,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
      },
    });
  } catch (error) {
    console.error('FIRMS fetch error:', error);
    return NextResponse.json({ fires: [], error: 'Failed to fetch fire data' }, { status: 500 });
  }
}

function parseCSV(csv: string): any[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const header = lines[0].split(',');
  const latIdx = header.indexOf('latitude');
  const lngIdx = header.indexOf('longitude');
  const brightIdx = header.indexOf('bright_ti4') !== -1 ? header.indexOf('bright_ti4') : header.indexOf('brightness');
  const confIdx = header.indexOf('confidence');
  const dateIdx = header.indexOf('acq_date');
  const timeIdx = header.indexOf('acq_time');
  const frpIdx = header.indexOf('frp');

  const fires: any[] = [];
  // Sample for performance — max 3000 fires
  const step = lines.length > 3000 ? Math.ceil(lines.length / 3000) : 1;

  for (let i = 1; i < lines.length; i += step) {
    const cols = lines[i].split(',');
    const lat = parseFloat(cols[latIdx]);
    const lng = parseFloat(cols[lngIdx]);
    if (isNaN(lat) || isNaN(lng)) continue;

    fires.push({
      lat: Math.round(lat * 1000) / 1000,
      lng: Math.round(lng * 1000) / 1000,
      brightness: parseFloat(cols[brightIdx]) || 0,
      confidence: cols[confIdx] || 'unknown',
      date: cols[dateIdx] || '',
      time: cols[timeIdx] || '',
      frp: parseFloat(cols[frpIdx]) || 0,
    });
  }

  return fires;
}
