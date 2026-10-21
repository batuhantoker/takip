/**
 * TAKIP AI Assist: what the assistant can see and switch on.
 *
 * The page keeps its live data in one bag (flights, ships, quakes, news and
 * the rest, each under its own key). This module names the parts the
 * assistant may search, turns each into one plain shape (a title, a detail
 * line, a place, a time and a figure), and says where each comes from, so the
 * server can fetch the same bag for MCP. It also lists the map layers the
 * assistant may switch, with words a model can choose by, and the panels it
 * may open. Pure and client-safe; the searching is in ./query.
 */
import { parseTLE, propagateSatrec } from '@/lib/feeds/satellites/orbit';

/** Something on the map, in one shape whatever feed it came from. */
export interface Entity {
  id: string;
  layer: FindLayer;
  title: string;
  detail: string;
  lat: number | null;
  lng: number | null;
  /** ms since the epoch, where the feed dates it. */
  time: number | null;
  /** The feed's headline figure: a magnitude, an altitude, fire power. */
  value: number | null;
  url?: string;
  /** The feed's own row, for filtering on its fields (./query/fields). */
  raw: Row;
}

export type FindLayer =
  | 'flights' | 'military_flights' | 'ships' | 'ports' | 'chokepoints' | 'earthquakes' | 'news'
  | 'incidents' | 'weather' | 'fires' | 'fire_incidents' | 'cameras' | 'satellites' | 'radiation' | 'air_raid_alerts'
  | 'launches' | 'infrastructure' | 'cables' | 'fire_perimeters';

export interface Source {
  /** What a model reads to choose it. */
  about: string;
  /** Map layers that show it (and make the page fetch it). */
  layers: string[];
  /** Where it sits in the page's data. */
  keys: string[];
  /** The route the page fetches it from, and how the answer maps onto `keys`. */
  feed?: { url: string; pick?: (body: Row) => Row };
  /** The page's data never holds it (a map hook fetches it for itself), so TI fetches it when asked. */
  own?: boolean;
  /** Minutes after which data this old reads as stale. */
  staleAfterMin?: number;
  /** Why a count is a floor, not a census: the feed does not see everything. */
  partial?: string;
  /** What `value` means, for `min` and sorting by largest. */
  value?: string;
  normalize: (row: Row, i: number) => Entity | null;
}

export type Row = Record<string, unknown>;

export const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);
export const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
export const time = (v: unknown): number | null => {
  const n = num(v);
  if (n !== null) return n < 1e12 ? n * 1000 : n;
  const t = Date.parse(str(v));
  return Number.isFinite(t) ? t : null;
};
const coords = (lat: unknown, lng: unknown): { lat: number | null; lng: number | null } => {
  const a = num(lat), b = num(lng);
  return a !== null && b !== null && Math.abs(a) <= 90 && Math.abs(b) <= 180 && !(a === 0 && b === 0) ? { lat: a, lng: b } : { lat: null, lng: null };
};
const join = (...parts: unknown[]) => parts.map(str).filter(Boolean).join(' · ');
/** A feed's link, if it is a web address: nothing else becomes a link in a card. */
const link = (v: unknown): string | undefined => (/^https?:\/\/[^\s]+$/i.test(str(v)) ? str(v) : undefined);

function flight(layer: FindLayer) {
  return (r: Row, i: number): Entity | null => {
    const at = coords(r.lat, r.lng);
    const alt = num(r.alt);
    return {
      id: str(r.icao24) || `${layer}-${i}`, layer, ...at, raw: r,
      title: str(r.callsign) || str(r.registration) || str(r.icao24) || 'Unidentified aircraft',
      detail: join(str(r.category), str(r.model) !== 'Unknown' ? r.model : '', alt !== null ? `${Math.round(alt).toLocaleString()} m` : '', num(r.speed_knots) !== null ? `${Math.round(num(r.speed_knots)!)} kn` : '', str(r.registration) !== 'N/A' ? r.registration : '', /^7[567]00$/.test(str(r.squawk)) ? `squawk ${str(r.squawk)}` : ''),
      time: null, value: alt,
    };
  };
}

/** Positions as of now: the bag holds where satellites were when the catalogue was fetched. */
const satrecs = new WeakMap<Row, ReturnType<typeof parseTLE>>();
function satNow(r: Row): { lat: number; lng: number; alt: number } | null {
  if (typeof r.line1 !== 'string' || typeof r.line2 !== 'string') return null;
  if (!satrecs.has(r)) satrecs.set(r, parseTLE(r.line1, r.line2));
  const rec = satrecs.get(r);
  const p = rec ? propagateSatrec(rec, new Date()) : null;
  return p ? { lat: p.lat, lng: p.lng, alt: p.altKm } : null;
}

/** The middle of a shape's bounding box: where a perimeter's pin goes. */
function centreOf(g: unknown): { lat: number | null; lng: number | null } {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  const walk = (c: unknown): void => {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === 'number' && typeof c[1] === 'number') {
      w = Math.min(w, c[0]); e = Math.max(e, c[0]); s = Math.min(s, c[1]); n = Math.max(n, c[1]);
    } else c.forEach(walk);
  };
  walk(g && typeof g === 'object' ? (g as Row).coordinates : null);
  return Number.isFinite(w) ? coords((s + n) / 2, (w + e) / 2) : { lat: null, lng: null };
}

const FLIGHTS_FEED = { url: '/api/flights' };
const MARITIME_FEED = { url: '/api/maritime', pick: (d: Row) => ({ maritime_ports: d.ports, maritime_chokepoints: d.chokepoints, maritime_ships: d.ships }) };
const ADSB_GAPS = 'ADS-B receivers miss the open ocean and parts of Africa, Asia and South America, and some aircraft do not broadcast';

export const SOURCES: Record<FindLayer, Source> = {
  flights: {
    about: 'Civil aircraft in the air now (airliners, private planes, business jets), from ADS-B. value = altitude in metres.',
    layers: ['flights', 'private', 'jets'], keys: ['commercial_flights', 'private_flights', 'private_jets'], value: 'altitude (m)',
    feed: FLIGHTS_FEED, staleAfterMin: 15, partial: ADSB_GAPS,
    normalize: flight('flights'),
  },
  military_flights: {
    about: 'Military aircraft broadcasting ADS-B. value = altitude in metres.',
    layers: ['military'], keys: ['military_flights'], value: 'altitude (m)',
    feed: FLIGHTS_FEED, staleAfterMin: 15, partial: `${ADSB_GAPS}; most military aircraft fly with their transponders off`,
    normalize: flight('military_flights'),
  },
  ships: {
    about: 'Ships reporting AIS positions (may be empty when the AIS feed is quiet).',
    layers: ['maritime'], keys: ['maritime_ships'], feed: MARITIME_FEED, staleAfterMin: 30,
    partial: 'AIS here comes from coastal receivers, so ships far offshore are missing',
    normalize: (r, i) => ({ id: str(r.mmsi) || `ship-${i}`, layer: 'ships', ...coords(r.lat, r.lng), raw: r, title: str(r.name) || `MMSI ${str(r.mmsi)}`, detail: join(r.type, r.destination ? `to ${str(r.destination)}` : '', num(r.speed) !== null ? `${num(r.speed)} kn` : ''), time: time(r.timestamp), value: num(r.speed) }),
  },
  ports: {
    about: 'Major container and energy ports with congestion. ',
    layers: ['maritime'], keys: ['maritime_ports'], feed: MARITIME_FEED,
    normalize: (r, i) => ({ id: `port-${str(r.name) || i}`, layer: 'ports', ...coords(r.lat, r.lng), raw: r, title: str(r.name), detail: join(r.country, r.type, r.congestion ? `congestion ${str(r.congestion).toLowerCase()}` : '', r.volume), time: null, value: num(r.rank) }),
  },
  chokepoints: {
    about: 'Maritime chokepoints (Hormuz, Suez, Malacca…) with traffic and risk.',
    layers: ['maritime'], keys: ['maritime_chokepoints'], feed: MARITIME_FEED,
    normalize: (r, i) => ({ id: `choke-${str(r.name) || i}`, layer: 'chokepoints', ...coords(r.lat, r.lng), raw: r, title: str(r.name), detail: join(r.traffic, r.risk ? `risk ${str(r.risk).toLowerCase()}` : ''), time: null, value: null }),
  },
  earthquakes: {
    about: 'Earthquakes of magnitude 2.5+ in the last day, from USGS. value = magnitude.',
    layers: ['earthquakes'], keys: ['earthquakes'], value: 'magnitude',
    feed: { url: '/api/earthquakes', pick: d => ({ earthquakes: d.earthquakes ?? [] }) }, staleAfterMin: 45,
    normalize: (r, i) => {
      const m = num(r.magnitude);
      return { id: str(r.id) || `eq-${i}`, layer: 'earthquakes', ...coords(r.lat, r.lng), raw: r, title: `M${m?.toFixed(1) ?? '?'} ${str(r.place)}`.trim(), detail: join(num(r.depth) !== null ? `${Math.round(num(r.depth)!)} km deep` : '', num(r.tsunami) ? 'tsunami flag' : '', r.alert ? `PAGER ${str(r.alert)}` : ''), time: time(r.time), value: m, url: link(r.url) };
    },
  },
  news: {
    about: 'Live news and OSINT reports (Telegram channels, wires). Some are placed on the map where they name a place. value = keyword risk score.',
    layers: [], keys: ['news'], value: 'risk score', staleAfterMin: 20,
    feed: { url: '/api/news', pick: d => ({ news: d.news ?? [] }) },
    partial: 'only the latest few hundred reports are held',
    normalize: (r, i) => {
      const place = (r.place && typeof r.place === 'object' ? r.place : {}) as Row;
      return { id: str(r.id) || `news-${i}`, layer: 'news', ...coords(place.lat, place.lng), raw: r, title: str(r.title), detail: join(r.source_name || r.source, place.name || place.label), time: time(r.published), value: num(r.risk_score), url: link(r.link) };
    },
  },
  incidents: {
    about: 'Global disaster and crisis alerts (GDACS: floods, cyclones, droughts, volcanoes).',
    layers: ['global_incidents'], keys: ['gdelt'], staleAfterMin: 90,
    feed: { url: '/api/gdelt', pick: d => ({ gdelt: d.events }) },
    normalize: (r, i) => ({ id: str(r.id) || `inc-${i}`, layer: 'incidents', ...coords(r.lat, r.lng), raw: r, title: str(r.name), detail: join(r.type), time: null, value: null, url: link(r.url) }),
  },
  weather: {
    about: 'Official weather, hazard and civil-emergency warnings: NOAA/NWS, NHC, ECCC, WMO members (Severe/Extreme), Hong Kong Observatory, Canadian evacuation orders, GDACS, NASA EONET storms and volcanoes.',
    layers: ['weather'], keys: ['weather_events'], staleAfterMin: 20,
    feed: { url: '/api/weather', pick: d => ({ weather_events: d.events }) },
    normalize: (r, i) => ({ id: str(r.id) || `wx-${i}`, layer: 'weather', ...coords(r.lat, r.lng), raw: r, title: str(r.title), detail: join(r.type, r.severity ? `${str(r.severity)} severity` : '', r.provider), time: time(r.date), value: null }),
  },
  fires: {
    about: 'Active fire detections from NASA FIRMS satellites. value = fire radiative power (MW).',
    layers: ['fires'], keys: ['fires'], value: 'fire power (MW)', feed: { url: '/api/fires' }, staleAfterMin: 180,
    normalize: (r, i) => ({ id: `fire-${i}`, layer: 'fires', ...coords(r.lat, r.lng), raw: r, title: `Fire, ${num(r.frp) ?? '?'} MW`, detail: join(r.confidence ? `${str(r.confidence)} confidence` : '', r.date), time: time(r.date), value: num(r.frp) }),
  },
  fire_incidents: {
    about: 'Agency-reported Canadian wildfires (CWFIS) with stage of control. value = burned area (ha).',
    layers: ['fires'], keys: ['fire_incidents'], value: 'area (ha)', feed: { url: '/api/fires' }, staleAfterMin: 180,
    normalize: (r, i) => ({ id: str(r.id) || `cwfis-${i}`, layer: 'fire_incidents', ...coords(r.lat, r.lng), raw: r, title: str(r.name) || 'Wildfire', detail: join(r.stageLabel, r.agency), time: time(r.updated), value: num(r.sizeHa), url: link(r.url) }),
  },
  fire_perimeters: {
    about: 'Wildfire and prescribed-burn perimeters mapped by US agencies (NIFC WFIGS), with acres burned and percent contained. value = acres.',
    layers: ['fires'], keys: ['fire_perimeters'], value: 'area (acres)', own: true, staleAfterMin: 180,
    feed: { url: '/api/fires/perimeters', pick: d => ({ fire_perimeters: d.features }) },
    normalize: (r, i) => {
      const p = (r.properties && typeof r.properties === 'object' ? r.properties : {}) as Row;
      const acres = num(p.acres), held = num(p.contained);
      return {
        id: str(p.id) || `perimeter-${i}`, layer: 'fire_perimeters', ...centreOf(r.geometry), raw: p, title: str(p.name) || 'Fire perimeter',
        detail: join(p.kind === 'prescribed' ? 'prescribed burn' : '', acres !== null ? `${Math.round(acres).toLocaleString('en-US')} acres` : '', held !== null ? `${held}% contained` : '', p.county, p.state),
        time: time(p.mapped) ?? time(p.discovered), value: acres,
      };
    },
  },
  radiation: {
    about: 'Gamma dose-rate monitors (EPA RadNet, rated against each station\'s previous week; Safecast sensors, unrated). value = nSv/h.',
    layers: ['radiation'], keys: ['radiation'], value: 'dose rate (nSv/h)', staleAfterMin: 20,
    feed: { url: '/api/radiation', pick: d => ({ radiation: d.stations }) },
    normalize: (r, i) => ({ id: str(r.id) || `rad-${i}`, layer: 'radiation', ...coords(r.lat, r.lng), raw: r, title: str(r.name), detail: join(r.status, r.city, r.network), time: time(r.time), value: num(r.reading), url: link(r.source) }),
  },
  air_raid_alerts: {
    about: 'Israeli Home Front Command sirens by locality (last 24 h) and Ukrainian air-raid alerts by oblast (standing now).',
    layers: ['war_alerts'], keys: ['war_alerts'], staleAfterMin: 5,
    feed: { url: '/api/war-alerts', pick: d => ({ war_alerts: d.alerts ?? [] }) },
    normalize: (r, i) => ({ id: str(r.id) || `war-${i}`, layer: 'air_raid_alerts', ...coords(r.lat, r.lng), raw: r, title: `${str(r.label)}: ${str(r.place)}`, detail: join(r.active === true ? 'active' : 'ended', r.country, r.provider), time: time(r.since), value: null, url: link(r.source) }),
  },
  cameras: {
    about: 'Live public traffic and city cameras.',
    // The map holds only pins (lib/feeds/cameras/pins.ts); TI fetches the full records when asked.
    layers: ['cctv'], keys: ['camera_records'], own: true, partial: 'only the public cameras TAKIP knows of',
    feed: { url: '/api/cctv?region=all', pick: d => ({ camera_records: Array.isArray(d.cameras) ? d.cameras : [] }) },
    normalize: (r, i) => ({ id: str(r.id) || `cam-${i}`, layer: 'cameras', ...coords(r.lat, r.lng), raw: r, title: str(r.name) || 'Camera', detail: join(r.city, r.country, r.source, r.offline === true ? 'off air' : ''), time: null, value: null }),
  },
  satellites: {
    about: 'Satellites in orbit now, by mission, placed where they are this moment. value = altitude in km.',
    layers: ['satellites'], keys: ['satellites'], value: 'altitude (km)',
    feed: { url: '/api/satellites?tle=1', pick: d => ({ ...d, satellites_at: d.timestamp }) },
    normalize: (r, i) => {
      const now = satNow(r);
      return { id: str(r.noradId) || `sat-${i}`, layer: 'satellites', ...coords(now?.lat ?? r.lat, now?.lng ?? r.lng), raw: r, title: str(r.name), detail: join(r.category, r.mission), time: null, value: now?.alt ?? num(r.alt) };
    },
  },
  launches: {
    about: 'Upcoming rocket launches at their pads (Launch Library 2), soonest first. time = the launch date.',
    layers: ['launches'], keys: ['launches'], staleAfterMin: 120,
    feed: { url: '/api/launches', pick: d => ({ launches: d.launches ?? [] }) },
    normalize: (r, i) => ({ id: str(r.id) || `launch-${i}`, layer: 'launches', ...coords(r.lat, r.lng), raw: r, title: str(r.name), detail: join(r.provider, r.pad, r.status_name, r.webcast_live === true ? 'webcast live' : ''), time: time(r.net), value: null, url: link(r.url) }),
  },
  infrastructure: {
    about: 'Critical infrastructure: nuclear power plants and other major facilities, with any earthquake risk flagged. value = capacity (MW).',
    layers: ['infrastructure'], keys: ['infrastructure'], value: 'capacity (MW)',
    feed: { url: '/api/infrastructure', pick: d => ({ infrastructure: d.infrastructure }) },
    normalize: (r, i) => ({ id: str(r.id) || `infra-${i}`, layer: 'infrastructure', ...coords(r.lat, r.lng), raw: r, title: str(r.name), detail: join(r.type, r.status, r.city, r.country), time: null, value: num(r.capacityMW) }),
  },
  cables: {
    about: 'Undersea internet cables by name (TeleGeography). value = length in km; the point is the cable\'s middle.',
    layers: ['cables'], keys: ['submarine_cables'], value: 'length (km)',
    feed: { url: '/data/submarine-cables.json', pick: d => ({ submarine_cables: d.features }) },
    normalize: (r, i) => {
      const p = (r.properties && typeof r.properties === 'object' ? r.properties : {}) as Row;
      const mid = Array.isArray(p.coordinates) ? p.coordinates as unknown[] : [];
      return { id: str(p.id) || `cable-${i}`, layer: 'cables', ...coords(mid[1], mid[0]), raw: p, title: str(p.name), detail: num(p.length_km) !== null ? `${Math.round(num(p.length_km)!).toLocaleString('en-US')} km` : '', time: null, value: num(p.length_km) };
    },
  },
};

export const FIND_LAYERS = Object.keys(SOURCES) as FindLayer[];

/** Every entity of a layer the page has loaded. */
export function entitiesOf(data: Record<string, unknown>, layer: FindLayer): Entity[] {
  const src = SOURCES[layer];
  const out: Entity[] = [];
  for (const key of src.keys) {
    const rows = data[key];
    if (!Array.isArray(rows)) continue;
    rows.forEach((r, i) => {
      if (!r || typeof r !== 'object') return;
      const e = src.normalize(r as Row, out.length + i);
      if (e && e.title) out.push(e);
    });
  }
  return out;
}

/** Whether the page has loaded a layer's data at all. */
export function loaded(data: Record<string, unknown>, layer: FindLayer): boolean {
  return SOURCES[layer].keys.some(k => Array.isArray(data[k]));
}

/* ───────────── Layers and panels the assistant may switch ───────────── */

/** Map layers by the page's own keys, with words a model can choose by. */
export const LAYERS: Record<string, string> = {
  flights: 'commercial airliners',
  private: 'private planes',
  jets: 'business jets',
  military: 'military aircraft',
  maritime: 'ships, ports and chokepoints',
  satellites: 'satellites in orbit',
  cctv: 'live public cameras',
  live_news: 'live news broadcasts placed on the map',
  earthquakes: 'earthquakes',
  fires: 'active fires (NASA FIRMS)',
  weather: 'weather warnings and storms',
  radiation: 'radiation monitoring stations',
  infrastructure: 'critical infrastructure (power plants, nuclear sites)',
  global_incidents: 'disaster alerts (GDACS)',
  alert_pins: 'news reports pinned to the places they name',
  war_alerts: 'war and air-raid alerts',
  airport_delays: 'US airport ground stops and delays (FAA)',
  alpr: 'licence-plate reader (ALPR) cameras mapped by volunteers on OpenStreetMap, US and Canada (DeFlock); details from zoom 9, the way each one looks from zoom 13',
  traffic: 'measured road traffic: roads running slower than usual or reported congested, tinted from zoom 10; the Netherlands (NDW), Rennes and Nantes',
  airport_weather: 'weather at airports worldwide from their latest METAR, coloured by flight category VFR, MVFR, IFR or LIFR (aviationweather.gov)',
  sigmets: 'hazard airspace worldwide: SIGMET areas for thunderstorms, turbulence, icing, volcanic ash and tropical cyclones (aviationweather.gov)',
  chokepoint_flow: 'shipping traffic through strategic straits against its own baseline (IMF PortWatch)',
  outbreaks: 'disease outbreak notices by country (WHO, CDC, ECDC)',
  day_night: 'day and night shading',
  cables: 'undersea internet cables',
  live_clouds: 'live satellite cloud cover',
  wx_temperature: 'global air temperature map (Open-Meteo)',
  wx_wind: 'global 10 m wind as moving streaks, coloured by speed (NOAA GFS forecast)',
  wx_radar: 'live precipitation radar (RainViewer)',
  wx_lightning: 'lightning strike density, the Americas and the Pacific (NOAA nowCOAST)',
  sat_live: 'live satellite picture of the whole Earth from the geostationary ring every 10 minutes, about 40 minutes behind: GOES and Meteosat in colour, Himawari infrared clouds over NASA Blue Marble across Asia-Pacific (NASA GIBS, EUMETSAT)',
  sat_daily: 'true-colour satellite picture of the whole Earth for one day, following the History or Replay date back to 2000-02-24, else yesterday (NASA GIBS, VIIRS and MODIS)',
  hiking_routes: 'marked hiking trails and long-distance walking routes (Waymarked Trails / OpenStreetMap)',
  transit: 'cities with live public transit and what runs there; live buses, trams and trains from zoom 10 (GTFS-RT feeds)',
  terrain_3d: '3D terrain',
  cyber_attacks: 'cyber attack indicators',
  gdelt_events: 'GDELT news events',
  cf_outages: 'internet outages (Cloudflare Radar)',
  malware: 'malware command-and-control servers',
  balloons: 'high-altitude balloons',
  launches: 'upcoming rocket launches at their pads',
  aurora: 'aurora visibility forecast (NOAA OVATION)',
  service_status: 'cloud and SaaS vendor incidents from their status pages',
  gps_jamming: 'likely GPS/GNSS interference, inferred from aircraft position accuracy',
};

/** Panels the assistant may open. */
export const PANELS: Record<string, string> = {
  markets: 'markets terminal: indices, commodities, crypto, FX',
  alerts: 'live alerts feed with the AI overview',
  intel: 'OSINT recon tools (IP, domain, username lookups)',
  layers: 'the layer panel',
  directions: 'driving directions',
  forecast: 'the TI forecast panel (the prediction engine)',
  workspace: 'the full-screen TI workspace for the current forecast',
};
