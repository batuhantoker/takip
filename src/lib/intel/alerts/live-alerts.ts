import { msg } from '@/lib/core/i18n/translator';
import { BLOCS, type AlertKind, type Bloc } from './digest';
import type { StoryAlert } from './gdelt-alerts';
import { LIVE_CHANNELS, liveEmbedUrl } from './live-tv';

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

/** The Live TV menu's channels, with their players; the same table /api/live-news serves the map. */
export const BUILTIN_FEEDS = LIVE_CHANNELS.map(c => ({ ...c, url: liveEmbedUrl(c) }));

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

export type AlertItem = NewsAlert | QuakeAlert | WarningAlert | StoryAlert;

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
  if (item.kind === 'story') return item.family === 'violence' ? 2 : 1;
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
  { max: 3_600_000, label: msg('LAST HOUR') },
  { max: 6 * 3_600_000, label: msg('1–6 HOURS AGO') },
  { max: 24 * 3_600_000, label: msg('6–24 HOURS AGO') },
  { max: Infinity, label: msg('OLDER') },
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
