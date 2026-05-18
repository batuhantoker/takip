import { NextResponse } from 'next/server';

/**
 * OSIRIS — Conflict Visualiser (Simulated) / Kinetic OSINT Feed
 * Fetches real-time GDELT data for kinetic strikes & conflict news pings.
 * Uses geopolitical inference to calculate deterministic origin coordinates.
 */

// Geopolitical inference removed per Issue #96 to prevent fabricated attribution.
function generateId() {
  return crypto.randomUUID();
}


let liveAlertsState: any[] = [];
let lastFetch = 0;

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('x-sim-auth');
    if (authHeader !== `Bearer ${process.env.NEXT_PUBLIC_SIM_TOKEN || 'osiris-sim-token'}` && authHeader !== (process.env.NEXT_PUBLIC_SIM_TOKEN || 'osiris-sim-token')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = Date.now();
    
    // Only fetch from GDELT every 60 seconds to avoid API bans
    if (now - lastFetch > 60000 || liveAlertsState.length === 0) {
      lastFetch = now;
      
      // Broader query to capture News Pings from Iran, Israel, etc.
      const query = '(Iran OR Israel OR Gaza OR Lebanon OR Ukraine OR Russia OR Yemen OR Syria) AND (conflict OR attack OR strike OR war OR missile OR rocket OR drone OR military)';
      const url = `https://api.gdeltproject.org/api/v2/geo/geo?query=${encodeURIComponent(query)}&mode=PointData&format=GeoJSON&timespan=24h&maxpoints=20`;
      
      let features = [];
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(8000)
        });

        if (res.ok) {
          const data = await res.json();
          features = data.features || [];
        }
      } catch (err) {
        console.warn('GDELT fetch timed out or failed, using fallback.');
      }



      const newAlerts = features.map((f: any) => {
        const targetLng = f.geometry?.coordinates?.[0];
        const targetLat = f.geometry?.coordinates?.[1];
        if (!targetLat || !targetLng) return null;

        const originData = { lat: targetLat + 1, lng: targetLng + 1, name: 'Simulated Origin' };
        const nameStr = (f.properties?.name || 'Unknown Location').split(',')[0];
        const htmlContent = f.properties?.html || '';
        
        let cleanUrl = f.properties?.url || '';
        if (!cleanUrl && htmlContent.includes('href="')) {
          cleanUrl = htmlContent.split('href="')[1].split('"')[0];
        }

        const text = (nameStr + ' ' + htmlContent).toLowerCase();
        let type = 'NEWS_PING';
        
        // Upgrade severity if specific kinetic keywords are found
        if (text.includes('ballistic')) type = 'BALLISTIC_MISSILE';
        else if (text.includes('cruise')) type = 'CRUISE_MISSILE';
        else if (text.includes('drone') || text.includes('uav')) type = 'DRONE_STRIKE';
        else if (text.includes('airstrike')) type = 'AIRSTRIKE';
        else if (text.includes('rocket')) type = 'ROCKET';
        else if (text.includes('attack') || text.includes('strike')) type = 'KINETIC_EVENT';

        // Flight duration between 2 to 4 minutes (now deterministic)
        const flightDuration = 180000;

        return {
          id: `alert-${generateId()}`,
          city: nameStr,
          originName: originData.name,
          type: type,
          launchTime: now,
          impactTime: now + flightDuration,
          origin: [originData.lng, originData.lat], // [lng, lat]
          target: [targetLng, targetLat],
          threatLevel: type.includes('MISSILE') ? 'CRITICAL' : type === 'NEWS_PING' ? 'ELEVATED' : 'HIGH',
          status: 'ACTIVE',
          source: 'SIMULATED',
          sourceUrl: cleanUrl
        };
      }).filter(Boolean);

      // Merge keeping max 12
      liveAlertsState = [...liveAlertsState, ...newAlerts].filter((a, i, self) => 
        a.impactTime > now && self.findIndex(t => t.city === a.city && t.type === a.type) === i
      ).slice(0, 12);
    }

    liveAlertsState = liveAlertsState.filter(a => a.impactTime > Date.now());

    const formattedAlerts = liveAlertsState.map(a => ({
      ...a,
      timeToImpactMs: Math.max(0, a.impactTime - Date.now())
    })).sort((a, b) => a.timeToImpactMs - b.timeToImpactMs);

    return NextResponse.json({
      alerts: formattedAlerts,
      defcon: formattedAlerts.some(a => a.threatLevel === 'CRITICAL') ? 2 : formattedAlerts.length > 0 ? 3 : 4,
      timestamp: new Date().toISOString(),
      simulated: true,
      data_quality: 'simulated'
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });

  } catch (error) {
    console.error('War simulator engine error:', error);
    return NextResponse.json({ alerts: [], error: 'OSINT engine failed' }, { status: 500 });
  }
}
