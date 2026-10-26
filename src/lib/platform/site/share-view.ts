import { haversine } from '@/lib/core/geodesic';
import { DEFAULT_LAYERS } from '@/lib/map/layers/defaults';
import { LANDING_CITIES } from '@/lib/places/landing-cities';
import { BASE_LAYERS } from './map-link';
import { SITE_PITCH } from './site-copy';
import { createTranslator, msg, type Translate } from '@/lib/core/i18n/translator';

/** What a layer is called in a sentence ("Earthquakes and ships near Tokyo"). Keys missing here are left out of titles. */
export const LAYER_NOUNS: Record<string, string> = {
  flights: msg('flights'), private: msg('private aircraft'), jets: msg('private jets'), military: msg('military aircraft'),
  airport_delays: msg('airport delays'), airport_weather: msg('airport weather'), sigmets: msg('hazard airspace'),
  maritime: msg('ships'), chokepoint_flow: msg('chokepoint traffic'),
  satellites: msg('satellites'), sat_comms: msg('Starlink and comms satellites'), sat_military: msg('military satellites'),
  sat_navigation: msg('navigation satellites'), sat_earth: msg('Earth-observation satellites'), sat_science: msg('space stations and telescopes'),
  balloons: msg('balloons'), launches: msg('rocket launches'), aurora: msg('the aurora forecast'),
  cctv: msg('live cameras'), alpr: msg('licence-plate readers'), live_news: msg('live news streams'), traffic: msg('road traffic'),
  transit: msg('buses and trains'), hiking_routes: msg('hiking routes'), things_to_do: msg('things to do'),
  earthquakes: msg('earthquakes'), fires: msg('wildfires'), weather: msg('severe weather'), radiation: msg('radiation readings'),
  outbreaks: msg('disease outbreaks'), infrastructure: msg('nuclear facilities'), global_incidents: msg('disaster alerts'),
  alert_pins: msg('alerts'), gdelt_events: msg('news events'), war_alerts: msg('air-raid alerts'), gps_jamming: msg('GPS interference'),
  malware: msg('malware sites'), cyber_attacks: msg('botnet servers'), cf_outages: msg('internet outages'), cf_attacks: msg('attack origins'),
  service_status: msg('service incidents'), cables: msg('undersea cables'),
  live_clouds: msg('live clouds'), wx_temperature: msg('temperature'), wx_wind: msg('wind'), wx_radar: msg('rain radar'),
  wx_lightning: msg('lightning'), sat_live: msg('live satellite imagery'), sat_daily: msg('daily satellite imagery'),
};

/** Satellites a link may follow that have a name people know. NORAD catalogue numbers. */
export const SATELLITE_NAMES: Record<string, string> = {
  '25544': msg('the ISS'), '48274': 'Tiangong', '20580': msg('the Hubble Space Telescope'),
  '41866': 'GOES-16', '51850': 'GOES-18', '39084': 'Landsat 8', '49260': 'Landsat 9',
  '25994': 'Terra', '27424': 'Aqua', '37849': 'Suomi NPP', '43013': 'NOAA-20',
};

type Params = Record<string, string | string[] | undefined>;

export interface SharedView {
  /** Null when the link names nothing, and the page keeps the site's own title. */
  title: string | null;
  description: string;
  /** The line under the title on the preview image. */
  caption: string;
  /** The checked, normalised query for the preview image, which describes it again; nothing in it is drawn as given. */
  imageQuery: string;
  /** The place the link opens at, for the preview's marker. */
  at: { lat: number; lon: number } | null;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const KNOWN = new Set(Object.keys(DEFAULT_LAYERS));
const QUIET = new Set<string>(BASE_LAYERS);

const capitalise = (s: string, tag: string) => s.charAt(0).toLocaleUpperCase(tag) + s.slice(1);

/** The data layers a link turns on, in the order of LAYER_NOUNS, without the quiet display ones or sub-filters. */
export function linkLayers(raw: string | undefined): string[] {
  if (!raw) return [];
  const on = new Set(raw.split(',').map(k => k.trim()).filter(k => KNOWN.has(k) && !QUIET.has(k)));
  return Object.keys(LAYER_NOUNS).filter(k => on.has(k));
}

function nearCity(lat: number, lon: number, zoom: number): string | null {
  if (zoom < 5) return null;
  let best: { name: string; km: number } | null = null;
  for (const c of LANDING_CITIES) {
    const km = haversine([lon, lat], [c.lng, c.lat]);
    if (km < 150 && (!best || km < best.km)) best = { name: c.name, km };
  }
  return best?.name ?? null;
}

const EN = createTranslator('en', {});

/** Reads a map link's query (as use-startup.ts does) into what its preview should say. No network: preview bots wait on this. */
export function describeView(params: Params, t: Translate = EN): SharedView {
  const q = new URLSearchParams();
  const lat = Number(first(params.lat));
  const lon = Number(first(params.lon));
  const zoomRaw = Number(first(params.zoom));
  const hasPlace = first(params.lat) !== undefined && first(params.lon) !== undefined
    && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  const zoom = Number.isFinite(zoomRaw) ? Math.min(18, Math.max(1.5, zoomRaw)) : 8;
  const at = hasPlace ? { lat, lon } : null;
  if (at) {
    q.set('lat', lat.toFixed(2));
    q.set('lon', lon.toFixed(2));
    q.set('zoom', zoom.toFixed(0));
  }

  const layers = linkLayers(first(params.layers));
  if (layers.length) q.set('layers', layers.join(','));

  const track = /^(aircraft|ship|satellite):([\w-]{1,40})$/i.exec(first(params.track) ?? '');
  const workspace = /^[A-Za-z0-9_-]{1,64}$/.test(first(params.w) ?? '');
  const aiRun = /^[\w-]{1,64}$/.test(first(params.ai) ?? first(params.oi) ?? '');
  const near = at ? nearCity(at.lat, at.lon, zoom) : null;
  const city = near && t(near);
  const pitch = t(SITE_PITCH);

  let title: string | null = null;
  let description = t('See it live on TAKIP, {pitch}.', { pitch });
  let caption = t('Flights, ships, satellites, cameras, weather and earthquakes on one free map.');
  if (track) {
    const kind = track[1].toLowerCase();
    const id = kind === 'aircraft' ? track[2].toUpperCase() : track[2];
    q.set('track', `${kind}:${kind === 'aircraft' ? id.toLowerCase() : id}`);
    if (kind === 'satellite') {
      const known = SATELLITE_NAMES[id];
      title = known ? t('Following {name} live', { name: t(known) }) : t('Following satellite {id} live', { id });
      caption = t('Where it is now, and where its orbit takes it next.');
      description = t('Follow it around the Earth as it moves, on TAKIP, {pitch}.', { pitch });
    } else {
      title = kind === 'aircraft' ? t('Following aircraft {id} live', { id }) : t('Following ship {id} live', { id });
      caption = t('From its latest reported position, on a free live map.');
      description = kind === 'aircraft'
        ? t('Follow it on the map from its latest position. If it has landed or gone out of range, the map says so. TAKIP is {pitch}.', { pitch })
        : t('Follow it on the map from its latest position. If it has gone out of range, the map says so. TAKIP is {pitch}.', { pitch });
    }
  } else if (workspace) {
    q.set('w', '1');
    title = t('A shared map view');
    caption = t('Open it to see the same place and layers, as they are now.');
    description = t('Someone shared a view on TAKIP with you: {pitch}.', { pitch });
  } else if (aiRun) {
    q.set('ai', '1');
    title = t('A forecast from TI');
    caption = t('What it read, where, and what it expects next.');
    description = t('A forecast TI drew on the map: what it read, where, and what it expects. TAKIP is {pitch}.', { pitch });
  } else if (layers.length) {
    const list = new Intl.ListFormat(t.intl, { type: 'conjunction' });
    const named = layers.slice(0, 3).map(k => t(LAYER_NOUNS[k]));
    if (layers.length > 3) named[2] = t('{n, plural, one {# more layer} other {# more layers}}', { n: layers.length - 2 });
    const things = capitalise(list.format(named), t.intl);
    title = city ? t('{things} near {city}, live', { things, city }) : t('{things}, live', { things });
    caption = t('As they are now, on a free live map of public data.');
    description = t('{things}, as they are now on TAKIP, {pitch}.', { things: capitalise(list.format(layers.slice(0, 4).map(k => t(LAYER_NOUNS[k]))), t.intl), pitch });
  } else if (city) {
    title = t('{city}, live', { city });
  }
  // A satellite has moved on by the time anyone opens the link, so its card marks no place.
  const satellite = track?.[1].toLowerCase() === 'satellite';
  return { title, description, caption, imageQuery: q.toString(), at: satellite ? null : at };
}
