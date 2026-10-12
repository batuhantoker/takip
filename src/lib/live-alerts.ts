import { BLOCS, type AlertKind, type Bloc } from './alert-digest';

export interface SourceHealth { handle: string; name: string; lean: string; bloc: Bloc; kind?: 'telegram' | 'wire'; count: number; latest: string | null }

/** The slice of dashboard state this panel reads. */
export interface LiveAlertsData {
  news?: unknown[];
  earthquakes?: unknown[];
  weather_events?: unknown[];
  news_meta?: { sources?: SourceHealth[]; fetchedAt?: string | null };
}

/** Where to fly: `alertId` also opens that report's pin on the map. */
export interface LocateOptions { zoom?: number; alertId?: string }

export const ACCENT = '#FF4081';

// Built-in live feeds — verified video IDs (synced with /api/live-news)
export const BUILTIN_FEEDS = [
  // ── North America ──
  { name: 'NBC News NOW', city: 'New York', country: 'US', lat: 40.759, lng: -73.980, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCeY0bbntWzzVIaj2z3QigXg&autoplay=1&mute=1', category: 'mainstream', region: 'americas' },
  { name: 'CBS News 24/7', city: 'New York', country: 'US', lat: 40.764, lng: -73.973, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UC8p1vwvWtl6T73JiExfWs1g&autoplay=1&mute=1', category: 'mainstream', region: 'americas' },
  { name: 'ABC News Live', city: 'New York', country: 'US', lat: 40.763, lng: -73.979, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCBi2mrWuNuyYy4gbM6fU18Q&autoplay=1&mute=1', category: 'mainstream', region: 'americas' },
  { name: 'Bloomberg TV', city: 'New York', country: 'US', lat: 40.756, lng: -73.988, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UC_vQ72b7v5n2938v9d5c80w&autoplay=1&mute=1', category: 'finance', region: 'americas' },
  { name: 'C-SPAN', city: 'Washington DC', country: 'US', lat: 38.897, lng: -77.036, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCb--64Gl51jIEVE-GLDAVTg&autoplay=1&mute=1', category: 'government', region: 'americas' },
  { name: 'CBC News', city: 'Toronto', country: 'CA', lat: 43.644, lng: -79.387, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCKy1dAqELon0zgzZPOz9SVw&autoplay=1&mute=1', category: 'mainstream', region: 'americas' },
  // ── Europe ──
  { name: 'Sky News', city: 'London', country: 'GB', lat: 51.500, lng: -0.118, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCoMdktPbSTixAyNGwb-UYkQ&autoplay=1&mute=1', category: 'mainstream', region: 'europe' },
  { name: 'France 24 EN', city: 'Paris', country: 'FR', lat: 48.830, lng: 2.280, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCQfwfsi5VrQ8yKZ-UWmAEFg&autoplay=1&mute=1', category: 'mainstream', region: 'europe' },
  { name: 'DW News', city: 'Berlin', country: 'DE', lat: 52.508, lng: 13.376, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCknLrEdhRCp1aegoMqRaCZg&autoplay=1&mute=1', category: 'mainstream', region: 'europe' },
  { name: 'Euronews', city: 'Lyon', country: 'FR', lat: 45.764, lng: 4.836, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCtUbOIRGKZkW7555n6x6q6g&autoplay=1&mute=1', category: 'mainstream', region: 'europe' },
  { name: 'TRT World', city: 'Istanbul', country: 'TR', lat: 41.008, lng: 28.978, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UC7fWeaHZQg1p9-4v98L1D1A&autoplay=1&mute=1', category: 'mainstream', region: 'europe' },
  { name: 'UKRINFORM', city: 'Kyiv', country: 'UA', lat: 50.450, lng: 30.523, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCaDkCK6iFHPE0lmpaYL-WxQ&autoplay=1&mute=1', category: 'conflict', region: 'europe' },
  // ── Middle East ──
  { name: 'Al Jazeera EN', city: 'Doha', country: 'QA', lat: 25.286, lng: 51.534, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCNye-wNBqNL5ZzHSJj3l8Bg&autoplay=1&mute=1', category: 'mainstream', region: 'middleeast' },
  { name: 'Al Mayadeen', city: 'Beirut', country: 'LB', lat: 33.8886, lng: 35.4955, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCZCFHCU-2eGF7V5ciMkoPHw&autoplay=1&mute=1', category: 'conflict', region: 'middleeast' },
  { name: 'LBCI Lebanon', city: 'Beirut', country: 'LB', lat: 33.8930, lng: 35.5018, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCpE6gpKewomi17XDyPfpFjA&autoplay=1&mute=1', category: 'mainstream', region: 'middleeast' },
  // ── Asia Pacific ──
  { name: 'NHK World', city: 'Tokyo', country: 'JP', lat: 35.690, lng: 139.692, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCSPEjw8F2nQDtmUKPFNF7_A&autoplay=1&mute=1', category: 'mainstream', region: 'asia' },
  { name: 'CNA 24/7', city: 'Singapore', country: 'SG', lat: 1.290, lng: 103.852, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UC83jt4dlz1Gjl58fzQrrKZg&autoplay=1&mute=1', category: 'mainstream', region: 'asia' },
  { name: 'WION', city: 'New Delhi', country: 'IN', lat: 28.614, lng: 77.209, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UC_gUM8rL-Lrg6O3adPW9K1g&autoplay=1&mute=1', category: 'mainstream', region: 'asia' },
  { name: 'Arirang', city: 'Seoul', country: 'KR', lat: 37.566, lng: 126.978, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCw9-5Y1CjW7Qy1Yf5q1y2-Q&autoplay=1&mute=1', category: 'mainstream', region: 'asia' },
  { name: 'ABC AU', city: 'Sydney', country: 'AU', lat: -33.868, lng: 151.209, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UC5iLnYoF4Ryb63YdGD9RfWQ&autoplay=1&mute=1', category: 'mainstream', region: 'asia' },
  // ── Africa ──
  { name: 'Africanews', city: 'Pointe-Noire', country: 'CG', lat: -4.778, lng: 11.865, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UC5T2fB_W0Z31T0c8yN36a8A&autoplay=1&mute=1', category: 'mainstream', region: 'africa' },
  { name: 'SABC News', city: 'Johannesburg', country: 'ZA', lat: -26.204, lng: 28.047, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UC8yH-uI81UUtEMDsowQyx1g&autoplay=1&mute=1', category: 'mainstream', region: 'africa' },
  // ── Latin America ──
  { name: 'teleSUR EN', city: 'Caracas', country: 'VE', lat: 10.491, lng: -66.902, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCmuTmpLY35O3csvhyA6vrkg&autoplay=1&mute=1', category: 'mainstream', region: 'americas' },
];

export const FEED_REGIONS: Record<string, string> = {
  americas: 'AMERICAS', europe: 'EUROPE', middleeast: 'MIDDLE EAST', asia: 'ASIA PACIFIC', africa: 'AFRICA',
};

export type Tab = 'all' | 'news' | 'warnings' | 'quakes' | 'feeds';

/** The official warnings from /api/weather — NOAA/NWS, GDACS and NASA EONET. */
export interface WarningAlert {
  kind: 'warning';
  id: string;
  ts: number;
  title: string;
  /** "Flash Flood Warning", "Tropical Cyclone" — the issuer's own words. */
  type: string;
  severity: 'high' | 'medium' | 'low';
  /** The counties or region it was issued for, where the issuer names them. */
  area: string | null;
  expires: number | null;
  provider: string;
  url: string | null;
  lat: number;
  lng: number;
  haystack: string;
}

interface Carrier { source: string; source_name: string; lean: string | null; bloc: Bloc | null; link: string | null; published: string | null }

export interface NewsAlert {
  kind: 'news';
  id: string;
  ts: number;
  title: string;
  summary: string;
  text: string;
  link: string | null;
  published: string;
  source: string;
  source_name: string;
  lean: string | null;
  bloc: Bloc | null;
  flag: string | null;
  alertKind: AlertKind;
  /** The place the report names, when one resolved; otherwise `anchor` is a country centroid. */
  place: { name: string; label: string; precision: 'settlement' | 'region' } | null;
  media: { kind: 'photo' | 'video'; thumb: string | null; duration: string | null; video: string | null; count: number } | null;
  forwarded_from: { name: string; url: string | null } | null;
  reply_to: string | null;
  views: number | null;
  carriers: Carrier[];
  keywords: string[];
  coords: [number, number] | null;
  anchor: string | null;
  haystack: string;
}

export interface QuakeAlert {
  kind: 'quake';
  id: string;
  ts: number;
  magnitude: number;
  place: string;
  depth: number | null;
  url: string | null;
  tsunami: boolean;
  felt: number | null;
  pager: string | null;
  lat: number;
  lng: number;
}

export type AlertItem = NewsAlert | QuakeAlert | WarningAlert;

/** What the list renders: one alert, or a run of statements from one speaker. */
export type Unit =
  | { kind: 'item'; key: string; ts: number; item: AlertItem }
  | { kind: 'statement'; key: string; ts: number; speaker: string; items: NewsAlert[] };

type Loose = Record<string, unknown>;
export const rec = (v: unknown): Loose => (v !== null && typeof v === 'object' ? (v as Loose) : {});
export const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
/** Only http(s) targets become links or image sources. */
const webUrl = (v: unknown): string | null => {
  const u = str(v);
  return u && /^https?:\/\//i.test(u) ? u : null;
};
const isBloc = (v: unknown): v is Bloc => typeof v === 'string' && Object.hasOwn(BLOCS, v);

export function toNews(raw: unknown): NewsAlert | null {
  const a = rec(raw);
  const title = str(a.title);
  const published = str(a.published);
  const ts = published ? Date.parse(published) : NaN;
  if (!title || !published || !Number.isFinite(ts)) return null;

  const text = str(a.description) ?? '';
  const summary = typeof a.summary === 'string'
    ? a.summary
    : text.startsWith(title) ? text.slice(title.length).trim() : text;
  const source = str(a.source) ?? 'unknown';
  const sourceName = str(a.source_name) ?? source;
  const lean = str(a.lean);

  const carriers: Carrier[] = (Array.isArray(a.also_reported_by) ? a.also_reported_by : []).map(item => {
    const c = rec(item);
    const cSource = str(c.source) ?? 'unknown';
    return {
      source: cSource,
      source_name: str(c.source_name) ?? cSource,
      lean: str(c.lean),
      bloc: isBloc(c.bloc) ? c.bloc : null,
      link: webUrl(c.link),
      published: str(c.published),
    };
  });

  const m = rec(a.media);
  const media: NewsAlert['media'] = m.kind === 'photo' || m.kind === 'video'
    ? { kind: m.kind, thumb: webUrl(m.thumb), duration: str(m.duration), video: webUrl(m.video), count: numOrNull(m.count) ?? 1 }
    : null;
  const p = rec(a.place);
  const placeName = str(p.name);
  const place: NewsAlert['place'] = placeName && (p.precision === 'settlement' || p.precision === 'region')
    ? { name: placeName, label: str(p.label) ?? placeName, precision: p.precision }
    : null;
  const fwd = rec(a.forwarded_from);
  const fwdName = str(fwd.name);
  const coords = Array.isArray(a.coords) && typeof a.coords[0] === 'number' && typeof a.coords[1] === 'number'
    ? [a.coords[0], a.coords[1]] as [number, number]
    : null;

  return {
    kind: 'news',
    id: str(a.id) ?? str(a.link) ?? title,
    ts,
    title,
    summary,
    text,
    link: webUrl(a.link),
    published,
    source,
    source_name: sourceName,
    lean,
    bloc: isBloc(a.bloc) ? a.bloc : null,
    flag: str(a.flag),
    alertKind: a.alert_kind === 'rocket' || a.alert_kind === 'event' ? a.alert_kind : 'news',
    place,
    media,
    forwarded_from: fwdName ? { name: fwdName, url: webUrl(fwd.url) } : null,
    reply_to: webUrl(a.reply_to),
    views: numOrNull(a.views),
    carriers,
    keywords: Array.isArray(a.risk_keywords) ? a.risk_keywords.filter((k): k is string => typeof k === 'string') : [],
    coords,
    anchor: str(a.coords_anchor),
    haystack: `${title} ${summary} ${sourceName} ${lean ?? ''} ${place?.label ?? ''} ${carriers.map(c => c.source_name).join(' ')}`.toLowerCase(),
  };
}

export function toQuake(raw: unknown): QuakeAlert | null {
  const eq = rec(raw);
  const magnitude = numOrNull(eq.magnitude);
  const time = numOrNull(eq.time);
  const lat = numOrNull(eq.lat);
  const lng = numOrNull(eq.lng);
  if (magnitude == null || time == null || lat == null || lng == null) return null;
  return {
    kind: 'quake',
    id: str(eq.id) ?? `${lat},${lng},${time}`,
    ts: time,
    magnitude,
    place: str(eq.place) ?? 'Unknown location',
    depth: numOrNull(eq.depth),
    url: webUrl(eq.url),
    tsunami: Boolean(eq.tsunami),
    felt: numOrNull(eq.felt),
    pager: str(eq.alert),
    lat,
    lng,
  };
}

export function toWarning(raw: unknown): WarningAlert | null {
  const w = rec(raw);
  const title = str(w.title);
  const lat = numOrNull(w.lat);
  const lng = numOrNull(w.lng);
  if (!title || lat == null || lng == null) return null;

  const issued = str(w.date);
  const ts = issued ? Date.parse(issued) : NaN;
  const expires = str(w.expires);
  const severity = w.severity === 'high' || w.severity === 'medium' ? w.severity : 'low';
  const type = str(w.type) ?? str(w.category) ?? 'Warning';
  const area = str(w.area);
  const provider = str(w.provider) ?? 'Official warning';

  return {
    kind: 'warning',
    id: str(w.id) ?? `${title}-${lat},${lng}`,
    /* An issuer that dates nothing is shown as current rather than dropped:
       an active warning is active whether or not it says when it was written. */
    ts: Number.isFinite(ts) ? ts : Date.now(),
    title,
    type,
    severity,
    area,
    expires: expires && Number.isFinite(Date.parse(expires)) ? Date.parse(expires) : null,
    provider,
    url: webUrl(w.source),
    lat,
    lng,
    haystack: `${title} ${type} ${area ?? ''} ${provider}`.toLowerCase(),
  };
}

export const SEVERITY_COLORS: Record<WarningAlert['severity'], string> = { high: '#FF3D3D', medium: '#FF9500', low: '#FFD700' };

/** Which of two alerts posted in the same minute a reader needs first. */
export function urgency(item: AlertItem): number {
  if (item.kind === 'warning') return item.severity === 'high' ? 4 : item.severity === 'medium' ? 3 : 1;
  if (item.kind === 'quake') return item.magnitude >= 6 ? 4 : item.magnitude >= 5 ? 2 : 1;
  return item.flag ? 3 : item.alertKind === 'rocket' ? 2 : 1;
}

export const quakeColor = (m: number) => (m >= 6 ? '#FF3D3D' : m >= 5 ? '#FF9500' : m >= 4 ? '#FFD700' : '#9CCC65');
export const PAGER_COLORS: Record<string, string> = { green: '#00E676', yellow: '#FFD700', orange: '#FF9500', red: '#FF3D3D' };
export const blocColor = (b: Bloc | null) => (b ? BLOCS[b].color : '#5C5A54');

export function compactCount(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`;
  return String(n);
}

export const BUCKETS = [
  { max: 3_600_000, label: 'LAST HOUR' },
  { max: 6 * 3_600_000, label: '1–6 HOURS AGO' },
  { max: 24 * 3_600_000, label: '6–24 HOURS AGO' },
  { max: Infinity, label: 'OLDER' },
];

/** The quote after the speaker label; in full, the whole post body after it. */
export function quoteOf(item: NewsAlert, speaker: string, full: boolean): string {
  if (!full) return item.title.slice(speaker.length + 2);
  const colon = item.text.search(/:\s/);
  return colon >= 0
    ? item.text.slice(colon + 1).trim()
    : [item.title.slice(speaker.length + 2), item.summary].filter(Boolean).join('\n');
}

/** How long a warning has left to run, as its issuer states it. */
export function expiryLabel(expires: number, now: number): string | null {
  const left = expires - now;
  if (left <= 0) return 'expired';
  const hours = left / 3_600_000;
  if (hours < 1) return `${Math.max(1, Math.round(left / 60_000))} min left`;
  if (hours < 48) return `${Math.round(hours)}h left`;
  return `${Math.round(hours / 24)}d left`;
}
