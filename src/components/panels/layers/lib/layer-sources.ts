import { msg } from '@/lib/core/i18n/translator';

/**
 * Where a layer's data comes from, for layers whose definition carries no
 * description. Shown as the row's second line; only real upstreams are named.
 */
const SOURCES: Record<string, string> = {
  flights: 'ADS-B · OpenSky, adsb.fi, adsb.lol',
  private: 'ADS-B · OpenSky, adsb.fi, adsb.lol',
  jets: 'ADS-B · OpenSky, adsb.fi, adsb.lol',
  military: 'ADS-B · OpenSky, adsb.fi, adsb.lol',
  maritime: msg('AIS via aisstream.io'),
  satellites: msg('CelesTrak orbital elements'),
  earthquakes: msg('USGS and EMSC'),
  weather: msg('NOAA/NWS, GDACS and NASA EONET'),
  cctv: msg('Public traffic and city cameras'),
  live_news: msg('Live streams on YouTube, checked every 30 minutes for what is on air'),
  gdelt_events: msg('GDELT 2.0 · sized by how many outlets report it'),
  malware: 'URLhaus · abuse.ch',
  cyber_attacks: 'Feodo Tracker · abuse.ch',
  cf_outages: 'Cloudflare Radar · IODA',
  cf_attacks: 'Cloudflare Radar',
  alert_pins: msg('Placed from the Alerts feed'),
};

export const sourceFor = (key: string, description?: string): string | undefined => description ?? SOURCES[key];
