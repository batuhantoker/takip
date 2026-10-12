import { lookupAirport, lookupAirportAsync, type Airport } from '@takip/connectors/airports';
import { stealthFetch } from '@takip/connectors/stealth-fetch';

export type RoutePair = { origin: Airport; destination: Airport };

const FETCH_TIMEOUT = 4000;
const COOLDOWN_MS = 3 * 60 * 1000;

/** Per source, when it may be asked again after answering 429. */
const cooldowns: Record<string, number> = {};

const isCooledDown = (src: string) => (cooldowns[src] || 0) > Date.now();
const setCooldown = (src: string) => {
  cooldowns[src] = Date.now() + COOLDOWN_MS;
};

/** Test seam: forget every cooldown. */
export function clearCooldowns(): void {
  for (const src of Object.keys(cooldowns)) delete cooldowns[src];
}

/** An airport as ADSBDB describes one; airplanes.live's are mapped to this shape. */
interface ListedAirport {
  latitude?: number | string;
  longitude?: number | string;
  name?: string;
  municipality?: string;
  country_iso_name?: string;
  iata_code?: string;
  icao_code?: string;
}

function fromListing(listed: ListedAirport | null | undefined, code: string): Airport | null {
  if (!listed?.latitude || !listed?.longitude) return null;
  return {
    iata: listed.iata_code || '', icao: listed.icao_code || code,
    name: listed.name || code, city: listed.municipality || '',
    country: listed.country_iso_name || '',
    lat: parseFloat(String(listed.latitude)), lng: parseFloat(String(listed.longitude)),
  };
}

/** Our airport table first, then ADSBDB's airport lookup, then the coordinates the route source supplied. */
async function resolveAirports(
  oCode: string | null | undefined,
  dCode: string | null | undefined,
  listedO?: ListedAirport | null,
  listedD?: ListedAirport | null,
): Promise<RoutePair | null> {
  if (!oCode || !dCode) return null;
  if (oCode === dCode) return null;

  let origin = lookupAirport(oCode) || await lookupAirportAsync(oCode);
  let dest   = lookupAirport(dCode) || await lookupAirportAsync(dCode);
  origin ??= fromListing(listedO, oCode);
  dest ??= fromListing(listedD, dCode);

  if (!origin || !dest) return null;
  if (!isFinite(origin.lat) || !isFinite(origin.lng) || !isFinite(dest.lat) || !isFinite(dest.lng)) return null;
  if (origin.lat === dest.lat && origin.lng === dest.lng) return null;
  return { origin, destination: dest };
}

/** "KJFK-EGLL", or "KJFK-LPPD-EGLL" with stops: the first and last codes. */
function splitRoute(route: unknown): [string, string] | null {
  if (typeof route !== 'string' || !route.includes('-')) return null;
  const parts = route.split('-');
  return [parts[0]?.trim(), parts[parts.length - 1]?.trim()];
}

async function ask(src: string, url: string): Promise<unknown> {
  if (isCooledDown(src)) throw new Error(`${src} cooled down`);
  const res = await stealthFetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (res.status === 429) { setCooldown(src); throw new Error(`${src} 429`); }
  if (!res.ok) throw new Error(`${src} ${res.status}`);
  return res.json();
}

interface AdsbdbRoute {
  response?: { flightroute?: { origin?: ListedAirport; destination?: ListedAirport } };
}

export async function fromAdsbdb(callsign: string): Promise<RoutePair> {
  const data = await ask('adsbdb', `https://api.adsbdb.com/v0/callsign/${encodeURIComponent(callsign)}`) as AdsbdbRoute | null;
  const route = data?.response?.flightroute;
  if (!route?.origin || !route?.destination) throw new Error('adsbdb: no route');
  const pair = await resolveAirports(
    route.origin.icao_code || route.origin.iata_code,
    route.destination.icao_code || route.destination.iata_code,
    route.origin, route.destination,
  );
  if (!pair) throw new Error('adsbdb: unresolved');
  return pair;
}

interface HexdbRoute {
  route?: unknown;
  origin?: string;
  destination?: string;
}

export async function fromHexdb(callsign: string): Promise<RoutePair> {
  const data = await ask('hexdb', `https://hexdb.io/api/v1/route/callsign/${encodeURIComponent(callsign)}`) as HexdbRoute;
  let oCode: string | null = null, dCode: string | null = null;
  const ends = splitRoute(data.route);
  if (ends) {
    [oCode, dCode] = ends;
  } else if (data.origin && data.destination) {
    oCode = data.origin; dCode = data.destination;
  }
  const pair = await resolveAirports(oCode, dCode);
  if (!pair) throw new Error('hexdb: unresolved');
  return pair;
}

interface AirplanesLiveAirport {
  icao?: string;
  iata?: string;
  lat?: number;
  lon?: number;
  name?: string;
  city?: string;
  country?: string;
}

interface AirplanesLiveAircraft {
  oDB?: AirplanesLiveAirport;
  dDB?: AirplanesLiveAirport;
  from?: string;
  to?: string;
  route?: unknown;
}

const listing = (db: AirplanesLiveAirport): ListedAirport | null =>
  db.lat && db.lon
    ? { latitude: db.lat, longitude: db.lon, name: db.name, municipality: db.city, country_iso_name: db.country, iata_code: db.iata || '', icao_code: db.icao }
    : null;

export async function fromAirplanesLive(icao24: string, callsign: string): Promise<RoutePair> {
  if (!icao24 && !callsign) throw new Error('no identifier');
  const url = icao24
    ? `https://api.airplanes.live/v2/hex/${encodeURIComponent(icao24)}`
    : `https://api.airplanes.live/v2/callsign/${encodeURIComponent(callsign)}`;
  const data = await ask('airplaneslive', url) as { ac?: AirplanesLiveAircraft[] } | null;
  const ac = data?.ac?.[0];
  if (!ac) throw new Error('airplaneslive: no ac');

  let oCode: string | null = null;
  let dCode: string | null = null;
  let listedO: ListedAirport | null = null;
  let listedD: ListedAirport | null = null;

  const ends = splitRoute(ac.route);
  if (ac.oDB?.icao && ac.dDB?.icao) {
    oCode = ac.oDB.icao; dCode = ac.dDB.icao;
    listedO = listing(ac.oDB);
    listedD = listing(ac.dDB);
  } else if (ac.from && ac.to) {
    oCode = ac.from; dCode = ac.to;
  } else if (ends) {
    [oCode, dCode] = ends;
  }

  const pair = await resolveAirports(oCode, dCode, listedO, listedD);
  if (!pair) throw new Error('airplaneslive: unresolved');
  return pair;
}
