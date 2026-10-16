import { timeAgo, type AlertKind } from '@/lib/intel/alerts/digest';
import type { ScheduledRoute } from '@/lib/feeds/aviation/flight-watch';
import type { AlertPinProps } from '@/lib/intel/alerts/map-pins';
import { htmlEsc, pop, popCoords, sentence, urlSafe, type PopTone } from './kit';
import { weatherLabel } from '@/lib/feeds/weather/weather-field';
import { formatTemperature, getTemperatureUnit } from '@/lib/feeds/weather/temperature-unit';

export { htmlEsc, urlSafe };

type FeatureProps = NonNullable<GeoJSON.GeoJsonProperties>;

/** What /api/flight-route adds to the schedule when given a position. */
export type ScheduleReply = ScheduledRoute & {
  progress?: number;
  totalDistanceKm?: number;
  departureTime?: string | null;
  arrivalTime?: string | null;
};

export const idSafe = (s: unknown): string => String(s ?? '').replace(/[^a-zA-Z0-9_.-]/g, '');

const num = (v: unknown, digits = 0, unit = ''): string | null => {
  const n = Number(v);
  return v == null || v === '' || !Number.isFinite(n) ? null : `${n.toFixed(digits)}${unit}`;
};

export function earthquakePopupHtml(p: FeatureProps, coords: number[]): string {
  const mag = Number(p.magnitude);
  const link = p.source === 'NIGGG-BAS'
    ? { href: 'https://ndc.niggg.bas.bg/', label: 'NIGGG-BAS' }
    : p.source === 'EMSC'
      ? { href: p.url, label: 'EMSC' }
      : { href: `https://earthquake.usgs.gov/earthquakes/eventpage/${encodeURIComponent(p.id || '')}`, label: 'USGS' };
  return pop({
    kicker: 'Earthquake',
    tone: mag >= 6 ? 'red' : mag >= 4.5 ? 'amber' : 'neutral',
    title: `Magnitude ${p.magnitude}`,
    subtitle: p.place || 'Unknown location',
    rows: [
      { label: 'Depth', value: num(p.depth, 0, ' km'), mono: true },
      { label: 'Location', value: popCoords(coords[1], coords[0]), mono: true },
      // A twin credited to the same network is the same solution, not a second opinion.
      p.twin_source && { label: `Also ${p.twin_source}`, value: `M${p.twin_magnitude}${p.twin_network ? ` · ${p.twin_network}` : ''}`, mono: true },
    ],
    links: [link],
  });
}

/** FIRMS gives the pass as a UTC date and an HHMM time. */
const firmsTime = (date: unknown, time: unknown) =>
  date && /^\d{3,4}$/.test(String(time)) ? `${date} ${String(time).padStart(4, '0').replace(/(\d\d)(\d\d)/, '$1:$2')} UTC` : null;

export function firePopupHtml(p: FeatureProps, coords: number[]): string {
  return pop({
    kicker: 'Fire hotspot',
    tone: 'amber',
    title: 'Heat detected by satellite',
    rows: [
      { label: 'Brightness', value: num(p.brightness, 0, ' K'), mono: true },
      { label: 'Fire power', value: p.frp ? num(p.frp, 1, ' MW') : null, mono: true },
      { label: 'Seen by', value: Number(p.satellites) > 1 ? `${p.satellites} satellites` : null },
      { label: 'Detected', value: firmsTime(p.date, p.time), mono: true },
      { label: 'Location', value: popCoords(coords[1], coords[0]), mono: true },
    ],
    links: [{ href: `https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;l:noaa20-viirs,viirs,modis_a,modis_t;@${coords[0]},${coords[1]},10z`, label: 'NASA FIRMS' }],
  });
}

const GDELT_FAMILY: Record<string, { label: string; tone: PopTone }> = {
  violence: { label: 'Violence', tone: 'red' },
  protest: { label: 'Protest', tone: 'violet' },
  tension: { label: 'Tension', tone: 'amber' },
  cooperation: { label: 'Cooperation', tone: 'green' },
};

interface GdeltLinkProps { url?: unknown; outlet?: unknown; title?: unknown; reports?: unknown }

/** MapLibre hands array properties back as JSON strings. */
const listProp = (v: unknown): GdeltLinkProps[] => {
  if (Array.isArray(v)) return v;
  try {
    const a = JSON.parse(String(v ?? '[]'));
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
};

const storyLink = (l: GdeltLinkProps, note = '') => `<a href="${urlSafe(l.url)}" target="_blank" rel="noopener noreferrer">
      ${l.title ? `<span class="tk-pop-list-title">${htmlEsc(l.title)}</span>` : ''}
      <span class="tk-pop-list-meta">${htmlEsc(l.outlet)}${note}</span>
    </a>`;

const hhmm = (v: unknown) => String(v ?? '').slice(11, 16);

export function gdeltEventPopupHtml(p: FeatureProps): string {
  const family = GDELT_FAMILY[String(p.family ?? '')] ?? { label: 'Event', tone: 'neutral' as PopTone };
  const reports = Number(p.reports) || 1;
  const outlets = Number(p.outlets) || 1;
  const who = [p.actor1, p.actor2].filter(Boolean).map(htmlEsc).join(' → ');
  const links = listProp(p.links).map(l => storyLink(l)).join('');
  const others = listProp(p.others).map(l => storyLink(l, ` · ${htmlEsc(l.reports)} reports`)).join('');
  const body = [
    who || p.action ? `<div>${who}${who && p.action ? ' · ' : ''}${htmlEsc(p.action)}</div>` : '',
    links ? `<div class="tk-pop-list">${links}</div>` : '',
    others ? `<div class="tk-pop-label">Other stories here</div><div class="tk-pop-list">${others}</div>` : '',
  ].join('');
  return pop({
    kicker: family.label,
    tone: family.tone,
    meta: `${reports} ${reports === 1 ? 'report' : 'reports'} · ${outlets} ${outlets === 1 ? 'outlet' : 'outlets'}`,
    title: p.name,
    subtitle: p.precision === 'region' ? 'Placed at the state or province centre' : undefined,
    body: body || undefined,
    rows: [
      { label: 'Goldstein scale', value: p.goldstein, mono: true, tone: Number(p.goldstein) < 0 ? 'red' : undefined },
      { label: 'Average tone', value: p.tone, mono: true },
      { label: 'Articles', value: p.articles, mono: true },
    ],
    note: `GDELT 2.0 · reported ${hhmm(p.first_seen)}–${hhmm(p.last_seen)} UTC`,
    wide: true,
  });
}

// GDACS is a natural-disaster feed; each alert carries its own report URL.
const INCIDENT_KIND: Record<string, [string, PopTone]> = {
  earthquake: ['Earthquake', 'amber'],
  wildfire: ['Wildfire', 'amber'],
  flood: ['Flood', 'blue'],
  weather: ['Tropical cyclone', 'violet'],
  volcano: ['Volcano', 'red'],
  drought: ['Drought', 'amber'],
};

export function incidentPopupHtml(p: FeatureProps): string {
  const [kicker, tone] = INCIDENT_KIND[String(p.kind)] ?? ['Disaster alert', 'red' as PopTone];
  return pop({
    kicker,
    tone,
    title: p.name || 'Unclassified incident',
    note: 'GDACS alert',
    links: [p.url && { href: p.url, label: 'GDACS report' }],
  });
}

export function conflictPopupHtml(p: FeatureProps, coords: number[]): string {
  const tone: PopTone = p.severity === 'war' ? 'red' : p.severity === 'high' ? 'amber' : 'neutral';
  return pop({
    kicker: p.severity === 'war' ? 'War' : 'Conflict',
    tone,
    meta: p.severity && p.severity !== 'war' ? `${sentence(p.severity)} severity` : undefined,
    title: p.label || 'Conflict',
    body: htmlEsc(p.description || ''),
    rows: [{ label: 'Location', value: popCoords(coords[1], coords[0]), mono: true }],
    links: [p.sourceUrl && { href: p.sourceUrl, label: 'Source' }],
  });
}

const SDK_SOURCE_URLS: Record<string, string> = {
  'AIS Maritime': 'https://www.marinetraffic.com',
  'AIS Stream': 'https://aisstream.io',
  'AIS → Lattice': 'https://aisstream.io',
  'ADS-B / OpenSky': 'https://opensky-network.org',
  'ADS-B → Lattice': 'https://opensky-network.org',
  'Naval Intelligence': 'https://www.odni.gov',
};

export function sdkLinkPopupHtml(p: FeatureProps): string {
  const srcUrl = p.url || SDK_SOURCE_URLS[p.source];
  const cable = p.domain === 'SEA';
  return pop({
    kicker: cable ? 'Submarine cable' : p.domain === 'AIR' ? 'Air corridor' : 'Naval route',
    tone: 'blue',
    title: p.fromName || (cable ? 'Submarine cable' : 'Route'),
    rows: [
      { label: cable ? 'Lands at' : 'To', value: p.toName || null },
      { label: 'Source', value: p.source || null },
    ],
    links: [srcUrl && { href: srcUrl, label: cable ? 'Submarine Cable Map' : 'Source' }],
  });
}

export function balloonPopupHtml(p: FeatureProps): string {
  const rate = Number(p.verticalRate);
  return pop({
    kicker: 'Balloon',
    dot: p.color,
    title: p.callsign,
    subtitle: [sentence(p.type), sentence(p.status)].filter(Boolean).join(' · '),
    rows: [
      { label: 'Altitude', value: num(p.altitude, 0, ' m'), mono: true },
      { label: 'Speed', value: num(p.speed, 0, ' km/h'), mono: true },
      { label: 'Vertical rate', value: Number.isFinite(rate) ? `${rate > 0 ? '+' : ''}${rate.toFixed(1)} m/s` : null, mono: true },
      { label: 'Temperature', value: num(p.temperature, 0, ' °C'), mono: true },
    ],
  });
}

const RAD_TONE: Record<string, PopTone> = { SPIKE: 'red', ELEVATED: 'amber', OFFLINE: 'neutral', UNRATED: 'neutral' };
const RAD_LABEL: Record<string, string> = { SPIKE: 'Spike', ELEVATED: 'Elevated', OFFLINE: 'Offline', UNRATED: 'Not rated', NORMAL: 'Normal' };

/** What the status means for this reading; UNRATED and OFFLINE are not "normal". */
function radiationVerdict(p: FeatureProps): string {
  const base = Number.isFinite(Number(p.baseline)) ? `${p.baseline} nSv/h` : null;
  const delta = Number(p.delta);
  switch (p.status) {
    case 'SPIKE':
    case 'ELEVATED':
      return `${delta >= 0 ? '+' : ''}${delta} over its 7-day mean${base ? ` of ${base}` : ''}. Rain washing radon out of the air does this for a few hours.`;
    case 'NORMAL':
      return `Within its own previous week${base ? ` (mean ${base})` : ''}.`;
    case 'OFFLINE':
      return 'No reading for over 6 hours; this is the last one it sent.';
    default:
      return 'No history to judge this reading against.';
  }
}

export function radiationPopupHtml(p: FeatureProps): string {
  const status = String(p.status ?? '');
  const t = Date.parse(String(p.time ?? ''));
  const tone = RAD_TONE[status] ?? 'violet';
  return pop({
    kicker: 'Radiation',
    tone,
    meta: RAD_LABEL[status] ?? sentence(status),
    title: p.name,
    subtitle: [p.city, p.country].filter(Boolean).join(', ') || undefined,
    rows: [
      { label: 'Reading', value: `${p.reading} nSv/h`, mono: true, tone: tone === 'red' || tone === 'amber' ? tone : undefined },
      { label: 'Measured', value: Number.isFinite(t) ? `${new Date(t).toISOString().slice(0, 16).replace('T', ' ')} UTC` : null, mono: true },
      { label: 'Network', value: p.network },
    ],
    note: radiationVerdict(p),
  });
}

export function weatherPointPopupHtml(p: Record<string, unknown>, coords: GeoJSON.Position): string {
  const dir = Number(p.windDir);
  const compass = Number.isFinite(dir) ? ` ${['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((((dir % 360) + 360) % 360) / 45) % 8]}` : '';
  const wind = num(p.wind, 0, ' km/h');
  return pop({
    kicker: 'Weather',
    meta: p.hour ? String(p.hour) : undefined,
    title: formatTemperature(p.temp, getTemperatureUnit()) ?? '—',
    subtitle: weatherLabel(p.code == null ? null : Number(p.code)),
    rows: [
      { label: 'Wind', value: wind ? `${wind}${compass}` : null, mono: true },
      { label: 'Gusts', value: num(p.gust, 0, ' km/h'), mono: true },
      { label: 'Rain, last hour', value: num(p.precip, 1, ' mm'), mono: true },
      { label: 'Cloud', value: num(p.cloud, 0, '%'), mono: true },
    ],
    note: `${popCoords(Number(coords[1]), Number(coords[0]), 0)} · 10° grid sample · Open-Meteo (CC BY 4.0)`,
  });
}

/** A reading of the temperature field where a label sits; GFS when it loaded, else the interpolated Open-Meteo grid. */
export function temperaturePointPopupHtml(p: Record<string, unknown>, coords: GeoJSON.Position): string {
  return pop({
    kicker: 'Temperature',
    meta: p.hour ? String(p.hour) : undefined,
    title: formatTemperature(p.temp, getTemperatureUnit()) ?? '—',
    subtitle: p.place ? String(p.place) : undefined,
    note: `${popCoords(Number(coords[1]), Number(coords[0]), 2)} · ${p.source === 'gfs' ? 'NOAA GFS 0.25° model grid' : 'Open-Meteo 10° grid, interpolated'}`,
  });
}

export function weatherEventPopupHtml(p: FeatureProps, coords: number[]): string {
  const high = p.severity === 'high';
  return pop({
    kicker: p.type || 'Weather event',
    tone: p.icon === 'volcano' ? 'red' : high ? 'red' : 'amber',
    meta: p.severity ? `${sentence(p.severity)} severity` : undefined,
    title: p.title || 'Unknown event',
    subtitle: p.area || undefined,
    rows: [p.provider
      ? { label: 'Issued by', value: p.provider }
      : { label: 'Location', value: popCoords(coords[1], coords[0]), mono: true }],
    links: [p.source && { href: p.source, label: 'Source' }],
  });
}

export function nuclearPopupHtml(p: FeatureProps, coords: number[]): string {
  const status = String(p.status ?? '');
  // Same order as the infra-dots paint expression, so the dot matches the marker clicked.
  const tone: PopTone =
    status.includes('SEISMIC RISK') ? 'amber' :
    status === 'Active Conflict Zone' ? 'red' :
    status.includes('Decommission') ? 'neutral' :
    status === 'Under Construction' ? 'amber' :
    'green';
  return pop({
    kicker: 'Nuclear facility',
    tone,
    title: p.name || 'Nuclear facility',
    subtitle: [p.city, p.country].filter(Boolean).join(', ') || undefined,
    rows: [
      { label: 'Status', value: sentence(status) || null },
      { label: 'Owner', value: p.owner || null },
      // Waste stores and research reactors carry 0 here; neither is an electrical figure.
      { label: 'Reactors', value: p.reactors ? p.reactors : null, mono: true },
      { label: 'Capacity', value: p.capacityMW ? `${Number(p.capacityMW).toLocaleString()} MWe` : null, mono: true },
      { label: 'Location', value: popCoords(coords[1], coords[0]), mono: true },
    ],
    links: [
      p.sourceUrl && { href: p.sourceUrl, label: 'Reference' },
      { href: `https://www.google.com/maps/@${coords[1]},${coords[0]},14z/data=!3m1!1e3`, label: 'Satellite view' },
    ],
  });
}

export function portPopupHtml(p: FeatureProps): string {
  const congestion = String(p.congestion || '');
  return pop({
    kicker: p.type === 'naval' ? 'Naval base' : p.type === 'energy' ? 'Energy port' : 'Container port',
    tone: p.type === 'naval' ? 'violet' : p.type === 'energy' ? 'amber' : 'neutral',
    title: p.name,
    subtitle: p.country || undefined,
    rows: [
      { label: 'Volume', value: p.volume || null },
      { label: 'Fleet', value: p.fleet || null },
      { label: 'Global rank', value: p.rank ? `#${p.rank}` : null, mono: true },
      !!congestion && { label: 'Congestion', value: sentence(congestion), tone: congestion === 'SEVERE' ? 'red' : congestion === 'CONGESTED' ? 'amber' : undefined },
      { label: 'Typical wait', value: p.dwell_time || null },
    ],
  });
}

export function chokepointPopupHtml(p: FeatureProps): string {
  const risk = String(p.risk || '');
  const tone: PopTone = risk === 'CRITICAL' ? 'red' : risk === 'HIGH' || risk === 'ELEVATED' ? 'amber' : 'neutral';
  return pop({
    kicker: 'Chokepoint',
    tone,
    meta: risk ? `${sentence(risk)} risk` : undefined,
    title: p.name,
    rows: [{ label: 'Traffic', value: p.traffic || null }],
  });
}

const ALERT_KIND: Record<AlertKind, { label: string; tone: PopTone }> = {
  rocket: { label: 'Rocket alert', tone: 'red' },
  event: { label: 'Event', tone: 'amber' },
  news: { label: 'News', tone: 'blue' },
};

export const alertPopupHtml = (reports: AlertPinProps[]) => {
  const [p, ...rest] = reports;
  const kind = ALERT_KIND[p.kind as AlertKind] ?? ALERT_KIND.news;
  const link = urlSafe(p.link);
  const video = urlSafe(p.video);
  const thumb = urlSafe(p.thumb);
  // Footage plays in place where Telegram serves the file; otherwise its preview links through.
  const media = video !== '#'
    ? `<video class="tk-pop-media" src="${video}"${thumb !== '#' ? ` poster="${thumb}"` : ''} controls playsinline preload="none"></video>`
    : thumb !== '#'
      ? `<a href="${link}" target="_blank" rel="noopener noreferrer"><img class="tk-pop-media" src="${thumb}" referrerpolicy="no-referrer" alt=""></a>
         ${p.media_kind === 'video' ? `<div class="tk-pop-note">Video on Telegram${p.duration ? ` · ${htmlEsc(p.duration)}` : ''}</div>` : ''}`
      : '';
  const more = rest.slice(0, 4).map(r => `<a href="${urlSafe(r.link)}" target="_blank" rel="noopener noreferrer">
      <span class="tk-pop-list-title">${htmlEsc(r.title)}</span>
      <span class="tk-pop-list-meta">${htmlEsc(r.source_name)} · ${htmlEsc(timeAgo(r.published))}</span>
    </a>`).join('');
  const body = `<div title="The place the post names, resolved against OpenStreetMap. Town-level: a post names a place, not an exact spot.">
      ${htmlEsc(p.place_label)} <span class="tk-pop-list-meta" style="display:inline">· ${p.precision === 'region' ? 'region' : 'place'} named in the post</span>
    </div>${media}${more ? `<div class="tk-pop-label">Also here</div><div class="tk-pop-list">${more}</div>` : ''}`;
  return pop({
    kicker: kind.label,
    tone: kind.tone,
    meta: timeAgo(p.published),
    title: p.title,
    subtitle: [p.source_name, p.lean].filter(Boolean).join(' · '),
    body,
    links: [link !== '#' && { href: p.link, label: 'Open the post' }],
    wide: true,
  });
};
