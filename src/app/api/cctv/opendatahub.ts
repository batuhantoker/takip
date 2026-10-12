import type { CctvCamera } from './types';
import { proxiedImageUrl } from './types';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * OSIRIS — South Tyrol and Dolomites webcams from the Open Data Hub (NOI Techpark) tourism API, no key.
 * Terms: per-record LicenseInfo; only rows marked CC0 are admitted.
 *
 * feratel (1,137 rows) and lts (no coordinates) are filtered out in the query. The idm and dss rows
 * left are resort and hotel cameras on their own hosts.
 */

const API = 'https://tourism.api.opendatahub.com/v1/WebcamInfo';
const PAGE_SIZE = 500;
const MAX_PAGES = 4;

export const ODH_BOUNDS = { minLat: 46.1, maxLat: 47.15, minLng: 10.4, maxLng: 12.6 };

/** feratel stays out until its terms are cleared; asfinag.ts carries the same 13 A22 cameras as `BRENNERO-Cam-N`. */
const COVERED_ELSEWHERE = ['feratel.com', 'autobrennero.it'];

/** Dolomiti Superski parks unplaced cameras here, from Oclini to Cortina. */
const FALLBACK_POINTS: [number, number][] = [[46.57416242246033, 11.673888187402358]];

export interface OdhWebcam {
  Id?: string | null;
  Source?: string | null;
  Active?: boolean | null;
  Shortname?: string | null;
  GpsInfo?: { Latitude?: number | null; Longitude?: number | null }[] | null;
  Webcamurl?: string | null;
  Streamurl?: string | null;
  ImageGallery?: { ImageUrl?: string | null }[] | null;
  LicenseInfo?: { License?: string | null; ClosedData?: boolean | null } | null;
}

function host(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function coveredElsewhere(url: string): boolean {
  const h = host(url);
  return !h || COVERED_ELSEWHERE.some(c => h === c || h.endsWith('.' + c));
}

function streamType(url: string): 'hls' | 'mp4' | null {
  if (/\.m3u8(\?|$)/i.test(url)) return 'hls';
  if (/\.mp4(\?|$)/i.test(url)) return 'mp4';
  return null;
}

/** An https URL, or an http one the proxy re-serves; anything else would be mixed content. */
function loadable(url: string | null | undefined): string | null {
  const u = url?.trim();
  if (!u || coveredElsewhere(u)) return null;
  const out = proxiedImageUrl(u);
  return out.startsWith('https://') || out.startsWith('/api/cctv/proxy') ? out : null;
}

export function mapWebcam(w: OdhWebcam): CctvCamera | null {
  const id = w?.Id?.trim();
  if (!id || w.Active !== true) return null;
  if (w.LicenseInfo?.ClosedData !== false || w.LicenseInfo?.License !== 'CC0') return null;

  const lat = w.GpsInfo?.[0]?.Latitude;
  const lng = w.GpsInfo?.[0]?.Longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const b = ODH_BOUNDS;
  if (lat! < b.minLat || lat! > b.maxLat || lng! < b.minLng || lng! > b.maxLng) return null;
  if (FALLBACK_POINTS.some(([la, ln]) => Math.abs(la - lat!) < 1e-6 && Math.abs(ln - lng!) < 1e-6)) return null;

  const still = w.ImageGallery?.find(g => g?.ImageUrl)?.ImageUrl || w.Webcamurl;
  // A row's other media must not sneak a feratel or A22 camera back in.
  if (still && coveredElsewhere(still.trim())) return null;
  const feed = loadable(still);
  const rawStream = w.Streamurl?.trim();
  const type = rawStream ? streamType(rawStream) : null;
  const stream = type ? loadable(rawStream) : null;
  if (!feed && !stream) return null;

  return {
    id: `odh-${id}`,
    lat: lat!,
    lng: lng!,
    name: w.Shortname?.trim() || 'South Tyrol Webcam',
    city: w.Source === 'dss' ? 'Dolomites' : 'South Tyrol',
    country: 'Italy',
    ...(feed ? { feed_url: feed } : {}),
    ...(stream ? { stream_url: stream, stream_type: type! } : {}),
    source: 'Open Data Hub',
  };
}

/** Same still under two ids (idm and dss both list many Kronplatz cameras). */
function mediaKey(cam: CctvCamera): string {
  return (cam.stream_url || cam.feed_url || '').replace(/^https?:\/\//i, '').toLowerCase();
}

function pageUrl(page: number): string {
  return `${API}?source=idm,dss&active=true&pagesize=${PAGE_SIZE}&pagenumber=${page}`
    + '&fields=Id,Source,Active,Shortname,GpsInfo,Webcamurl,Streamurl,ImageGallery,LicenseInfo';
}

export function collectWebcams(items: OdhWebcam[]): CctvCamera[] {
  const ids = new Set<string>();
  const media = new Set<string>();
  const cams: CctvCamera[] = [];
  for (const item of items) {
    const cam = mapWebcam(item);
    if (!cam || ids.has(cam.id) || media.has(mediaKey(cam))) continue;
    ids.add(cam.id);
    media.add(mediaKey(cam));
    cams.push(cam);
  }
  return cams;
}

export async function fetchOpenDataHubCameras(): Promise<CctvCamera[]> {
  const items: OdhWebcam[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await stealthFetch(pageUrl(page), { signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error(`Open Data Hub HTTP ${res.status}`);
    const data = await res.json();
    items.push(...(data?.Items || []));
    if (!(Number(data?.TotalPages) > page)) break;
  }

  const cams = collectWebcams(items);
  console.log(`[OSIRIS] South Tyrol cameras — Open Data Hub: ${cams.length}`);
  return cams;
}
