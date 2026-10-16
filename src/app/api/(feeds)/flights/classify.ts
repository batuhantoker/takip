import { AIRLINE_CODE_RE, aircraftCategory, isHelicopter } from '@takip/core/aircraft';

/** A tar1090-shaped row (adsb.lol, adsb.fi, or OpenSky mapped onto it) as the map draws it; null for a ground station. */
export function classifyFlight(f: any) {
  const modelUpper = (f.t || '').toUpperCase();
  const flightStr = (f.flight || '').trim().toUpperCase();

  if (modelUpper === 'TWR') return null;

  const lat = f.lat;
  const lon = f.lon;
  if (lat == null || lon == null) return null;

  const callsign = flightStr || f.hex || 'UNKNOWN';
  const altRaw = f.alt_baro;
  const altMeters = typeof altRaw === 'number' ? altRaw * 0.3048 : 0;
  const speedKnots = typeof f.gs === 'number' ? Math.round(f.gs * 10) / 10 : null;
  const heading = f.track || 0;
  // tar1090 feeds report aircraft on the ground as alt_baro "ground".
  const isGrounded = altRaw === 'ground' || (typeof altRaw === 'number' && altRaw < 100);
  const airlineMatch = AIRLINE_CODE_RE.exec(callsign);
  const airlineCode = airlineMatch ? airlineMatch[1] : '';
  // Shared with the replay seal jobs, so history splits traffic the same way the live map does.
  const category = aircraftCategory({ ...f, altMeters, speedKnots });

  return {
    callsign,
    lat: Math.round(lat * 100000) / 100000,
    lng: Math.round(lon * 100000) / 100000,
    alt: Math.round(altMeters),
    heading: Math.round(heading),
    speed_knots: speedKnots,
    model: f.t || 'Unknown',
    icao24: f.hex || '',
    registration: f.r || 'N/A',
    squawk: f.squawk || '',
    airline_code: airlineCode,
    aircraft_category: isHelicopter(f) ? 'heli' : 'plane',
    category,
    grounded: isGrounded,
    nac_p: f.nac_p,
    // ADS-B's own emergency status (general, lifeguard, minfuel, nordo, unlawful, downed); OpenSky has none.
    emergency: typeof f.emergency === 'string' && f.emergency !== 'none' ? f.emergency : undefined,
    type: 'flight',
  };
}
