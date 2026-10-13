/**
 * Where a layer's data comes from, for layers whose definition carries no
 * description. Shown as the row's second line; only real upstreams are named.
 */
const SOURCES: Record<string, string> = {
  flights: 'ADS-B · OpenSky, adsb.fi, adsb.lol',
  private: 'ADS-B · OpenSky, adsb.fi, adsb.lol',
  jets: 'ADS-B · OpenSky, adsb.fi, adsb.lol',
  military: 'ADS-B · OpenSky, adsb.fi, adsb.lol',
  maritime: 'AIS via aisstream.io',
  satellites: 'CelesTrak orbital elements',
  earthquakes: 'USGS and EMSC',
  weather: 'NOAA/NWS, GDACS and NASA EONET',
  cctv: 'Public traffic and city cameras',
  live_news: 'Live streams on YouTube and Rumble',
  gdelt_events: 'GDELT 2.0 · sized by how many outlets report it',
  malware: 'URLhaus · abuse.ch',
  cyber_attacks: 'Feodo Tracker · abuse.ch',
  cf_outages: 'Cloudflare Radar',
  cf_attacks: 'Cloudflare Radar',
  alert_pins: 'Placed from the Alerts feed',
};

export const sourceFor = (key: string, description?: string): string | undefined => description ?? SOURCES[key];
