import type { CctvCamera } from '@/lib/feeds/cameras/types';
import { proxiedImageUrl } from '@/lib/feeds/cameras/types';
import { stealthFetch } from '@/lib/core/net/stealth-fetch';

/**
 * TAKIP — Alpine webcams from the Open Data Hub (NOI Techpark) tourism API, no key: South Tyrol and
 * Dolomites resort cameras (idm, dss) plus feratel's catalogue across the Alps (~1,050).
 * Terms: per-record LicenseInfo; most rows are CC0, idm rows carry none. Rows marked closed are dropped.
 *
 * lts (no coordinates) is filtered out in the query.
 */

const API = 'https://tourism.api.opendatahub.com/v1/WebcamInfo';
const PAGE_SIZE = 500;
const MAX_PAGES = 4;

export const ODH_BOUNDS = { minLat: 43, maxLat: 56, minLng: -6, maxLng: 21 };

/** asfinag.ts carries the same 13 A22 cameras as `BRENNERO-Cam-N`; panomax.ts carries every Panomax camera. */
const COVERED_ELSEWHERE = ['autobrennero.it', 'panomax.com'];

/** ODH lists feratel stills as http; the same host serves them over https. */
const HTTPS_HOSTS = ['wtvthmb.feratel.com'];

/** Dolomiti Superski parks unplaced cameras here: Oclini, and a point in Zürich. */
const FALLBACK_POINTS: [number, number][] = [
  [46.57416242246033, 11.673888187402358],
  [47.3688387, 8.53751490000002],
];

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
  let u = url?.trim();
  if (!u || coveredElsewhere(u)) return null;
  const h = host(u);
  if (h && HTTPS_HOSTS.includes(h)) u = u.replace(/^http:\/\//i, 'https://');
  const out = proxiedImageUrl(u);
  return out.startsWith('https://') || out.startsWith('/api/cctv/proxy') ? out : null;
}

export function mapWebcam(w: OdhWebcam): CctvCamera | null {
  const id = w?.Id?.trim();
  if (!id || w.Active !== true || w.LicenseInfo?.ClosedData === true) return null;

  const lat = w.GpsInfo?.[0]?.Latitude;
  const lng = w.GpsInfo?.[0]?.Longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const b = ODH_BOUNDS;
  if (lat! < b.minLat || lat! > b.maxLat || lng! < b.minLng || lng! > b.maxLng) return null;
  if (FALLBACK_POINTS.some(([la, ln]) => Math.abs(la - lat!) < 1e-6 && Math.abs(ln - lng!) < 1e-6)) return null;

  const still = w.ImageGallery?.find(g => g?.ImageUrl)?.ImageUrl || w.Webcamurl;
  // A row's other media must not sneak an A22 or Panomax camera back in.
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
    name: w.Shortname?.trim() || 'Webcam',
    // feratel rows span the Alps and carry no place, only coordinates.
    city: w.Source === 'feratel' ? '' : w.Source === 'dss' ? 'Dolomites' : 'South Tyrol',
    country: w.Source === 'feratel' ? '' : 'Italy',
    ...(feed ? { feed_url: feed } : {}),
    ...(stream ? { stream_url: stream, stream_type: type! } : {}),
    source: 'Open Data Hub',
  };
}

/** Same still under two ids: idm and dss both list Kronplatz, dss and feratel both list feratel stills. */
function mediaKey(cam: CctvCamera): string {
  const url = (cam.stream_url || cam.feed_url || '').replace(/^https?:\/\//i, '').toLowerCase();
  // A feratel query only picks a page design; the path is the camera.
  return url.startsWith('wtvthmb.feratel.com/') ? url.split('?')[0] : url;
}

function pageUrl(page: number): string {
  return `${API}?source=idm,dss,feratel&active=true&pagesize=${PAGE_SIZE}&pagenumber=${page}`
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
  console.log(`[TAKIP] Alpine cameras — Open Data Hub: ${cams.length}`);
  return cams;
}
