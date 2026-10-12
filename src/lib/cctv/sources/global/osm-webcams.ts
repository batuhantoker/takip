import type { CctvCamera } from '@/lib/cctv/types';
import { cachedSource } from '@/lib/sourceCache';
import { TAKIP_UA } from '@/lib/httpJson';

/**
 * TAKIP — public webcams mapped in OpenStreetMap (~1,500 worldwide): elements whose `contact:webcam` is a direct
 * https still or an embeddable player, from one pre-filtered Overpass query, no key.
 * Terms: ODbL; credit "© OpenStreetMap contributors". The images belong to whoever runs each camera.
 *
 * `webcam=*` and `surveillance:type=webcam` add under ten direct images worldwide, not worth a second key scan.
 */

const OVERPASS = 'https://overpass-api.de/api/interpreter';
/**
 * The query takes 17-30s on overpass-api.de and 504s when the server is busy, so it cannot fit the route's 12s
 * budget; the cache keeps the request running and serves it to the next caller.
 */
const TIMEOUT_MS = 60_000;
const QUERY = String.raw`[out:json][timeout:55];
nwr["contact:webcam"~"^https://.*(\\.(jpe?g|png)([?#].*)?$|youtube\\.com/(watch|live|embed)|youtu\\.be/|rtsp\\.me/embed/|ipcamlive\\.com/player/)",i]["surveillance"!="indoor"]["access"!="private"];
out tags center;`;
const SOURCE = '© OpenStreetMap contributors';

export const OSM_WEBCAMS_BOUNDS = { minLat: -85, maxLat: 85, minLng: -180, maxLng: 180 };

/** Networks TAKIP already carries through their own adapters; OSM copies would double their markers. */
const COVERED = [
  'informo.madrid.es', 'trafficnz.info', 'images.wsdot.wa.gov', 'tripcheck.com', 'seattle.gov', 'dgt.es',
  'dot.ny.gov', 'eot.state.ma.us', 'dot.state.oh.us', 'mto.gov.on.ca', 'dot.ca.gov', 'trafikverket.se',
  'data.one.gov.hk', 'river.go.jp', 'autobrennero.it', 'trimarc.org', 'transport.nsw.gov.au', 'asfinag.at',
  'transpordiamet.ee', 'vegvesen.no', 'bayerninfo.de', 'i-traffic.co.za', 'trafiroutes.wallonie.be', 'phenocam.nau.edu',
  'road-info-prvs.mlit.go.jp', 'faa.gov', 'usgs-nims-images.s3.amazonaws.com', 'volcview.wr.usgs.gov', 'nysmesonet.org',
  'goakamai.org', 'algotraffic.com', 'trafficcam.calgary.ca', 'yorkmaps.ca', 'wra.gov.tw', 'wtvthmb.feratel.com',
  'modot.mo.gov', 'dot.nd.gov', 'nmroads.com', 'wv511.org', 'oktraffic.org', 'sha.maryland.gov',
  'kahramanmaras.bel.tr', 'ibb.gov.tr', 'lakecountypassage.com', 'irecam.carsprogram.org',
  'camstreamer.com', 'siata.gov.co', 'myairportcams.com', 'onlyweathercams.com', 'qldtraffic.qld.gov.au',
  'panomax.com', 'webcamera.pl', 'foto-webcam.eu',
];
/** Never cameras: archived snapshots, a router vendor's product shots, a surveillance-mapping project. */
const JUNK = ['web.archive.org', 'static.tp-link.com', 'deflock.me'];
const BANNED = ['windy.com', 'insecam.org', 'opentopia.com', 'opencctv.org'];
/** Home-router hostnames: a camera behind one is somebody's house. */
const DYNAMIC_DNS = [
  'dyndns.org', 'dyndns.info', 'no-ip.org', 'no-ip.biz', 'no-ip.info', 'noip.me', 'ddns.net', 'duckdns.org',
  'myfritz.net', 'hopto.org', 'zapto.org', 'sytes.net', 'servebeer.com', 'serveftp.com', 'dynu.net', 'freeddns.org',
  'myqnapcloud.com', 'synology.me', 'dlinkddns.com', 'tplinkdns.com', 'ddnsfree.com', 'webhop.me', 'selfip.com',
  'homeip.net', 'gotdns.ch', 'myds.me', 'i234.me', 'asuscomm.com', 'dvrdns.org', 'camdvr.org', 'kozow.com',
  'mooo.com', 'changeip.com', 'ipv64.de',
];
const CREDENTIAL_PARAM = /[?&](pwd|pass|passwd|password|usr|user|username|auth)=/i;
/** Camera firmware endpoints, as opposed to a still a website publishes. */
const CAMERA_CGI = /\/axis-cgi\/|\/cgi-bin\/|\/video\b|faststream|mjpe?g/i;
const IMAGE_PATH = /\.(jpe?g|png)$/i;
const YOUTUBE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|live\/|embed\/)|youtu\.be\/)([\w-]{11})(?![\w-])/;
const PLAYER = /^https:\/\/(?:rtsp\.me\/embed\/|(?:\w+\.)?ipcamlive\.com\/player\/)/i;

export interface OsmElement {
  type?: string | null;
  id?: number | null;
  lat?: number | null;
  lon?: number | null;
  /** Ways and relations, from `out center`. */
  center?: { lat?: number | null; lon?: number | null } | null;
  tags?: Record<string, string> | null;
}

const onDomain = (host: string, list: string[]) => list.some(d => host === d || host.endsWith('.' + d));

/** The URL when it is a public https address on a named host, else null. */
function publicUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.port || url.username || url.password) return null;
  // IP literals: a public site names its host, and RFC1918 ones are someone's LAN.
  if (/^[\d.]+$/.test(host) || host.startsWith('[')) return null;
  if (CREDENTIAL_PARAM.test(url.search) || CAMERA_CGI.test(url.pathname)) return null;
  if (onDomain(host, DYNAMIC_DNS) || onDomain(host, BANNED) || onDomain(host, JUNK) || onDomain(host, COVERED)) return null;
  return url;
}

export function mapOsmWebcam(el: OsmElement | null | undefined): CctvCamera | null {
  const type = el?.type;
  const id = el?.id;
  if ((type !== 'node' && type !== 'way' && type !== 'relation') || !Number.isInteger(id)) return null;

  const tags = el!.tags ?? {};
  if (tags.surveillance === 'indoor' || tags.surveillance === 'private' || tags.access === 'private') return null;

  const lat = el!.lat ?? el!.center?.lat;
  const lng = el!.lon ?? el!.center?.lon;
  if (typeof lat !== 'number' || typeof lng !== 'number' || (lat === 0 && lng === 0)) return null;
  const b = OSM_WEBCAMS_BOUNDS;
  if (lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng) return null;

  const raw = tags['contact:webcam']?.split(';')[0].trim() ?? '';
  const url = publicUrl(raw);
  if (!url) return null;

  let media: Pick<CctvCamera, 'feed_url' | 'stream_url' | 'stream_type'>;
  const video = YOUTUBE.exec(raw)?.[1];
  if (video) media = { stream_url: `https://www.youtube.com/embed/${video}?autoplay=1&mute=1`, stream_type: 'iframe' };
  else if (PLAYER.test(raw)) media = { stream_url: url.href, stream_type: 'iframe' };
  else if (IMAGE_PATH.test(url.pathname)) media = { feed_url: url.href };
  else return null;

  const name = (tags.name || tags.description || tags.operator || '').replace(/\s+/g, ' ').trim();
  return {
    id: `osm-${type}-${id}`,
    lat,
    lng,
    name: name || 'Webcam',
    city: tags['addr:city']?.trim() || '',
    country: '',
    ...media,
    external_url: `https://www.openstreetmap.org/${type}/${id}`,
    source: SOURCE,
  };
}

export async function loadOsmWebcams(): Promise<CctvCamera[]> {
  // Overpass turns away spoofed browser user agents, so this one identifies itself.
  const res = await fetch(OVERPASS, {
    method: 'POST',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': TAKIP_UA, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: QUERY }).toString(),
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data?.elements)) throw new Error('Overpass: no elements in response');
  // A timed-out query still answers 200, with a remark and whatever it had collected.
  if (data.remark) throw new Error(`Overpass: ${String(data.remark).slice(0, 160)}`);

  const seen = new Map<string, CctvCamera>();
  for (const el of data.elements as OsmElement[]) {
    const cam = mapOsmWebcam(el);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] OSM webcams — OpenStreetMap: ${seen.size}`);
  return [...seen.values()];
}

/** Tags change slowly and the query costs Overpass 17–30 s, so it runs once a day. */
export const fetchOsmWebcams = cachedSource('osm-webcams-index', loadOsmWebcams, 24 * 60 * 60_000);
