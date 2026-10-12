import type { CctvCamera } from '@/lib/cctv/types';
import type { Bounds } from '@/lib/cctv/sources/platforms/cars';

/**
 * TAKIP — Serbian Interior Ministry (MUP) border-crossing cameras: two HLS streams per crossing, no key.
 * No licence stated; permission not yet asked. The portal lists stream URLs in toggleCamera(...) calls
 * but no positions, so crossings are placed from the OSM gazetteer below. About half the playlists
 * answer 404 at any time (2026-10-12: 13 of 32), so only live ones are kept, checked on each refresh.
 */

// "камерe" spelt with a Cyrillic е, as the portal does.
const PAGE = 'https://www.mup.gov.rs/wps/portal/sr/kamer%D0%B5/kamer%D0%B5GP';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
export const MUP_SERBIA_BOUNDS: Bounds = { minLat: 42.2, maxLat: 46.2, minLng: 18.8, maxLng: 23.0 };

/** OSM border-crossing points (Nominatim/Photon, 2026-10-12), keyed by the stream folder. */
export const MUP_CROSSINGS: Record<string, { lat: number; lng: number; name: string; to: string }> = {
  Kelebija: { lat: 46.1659, lng: 19.56232, name: 'Kelebija', to: 'Hungary' },
  Horgos: { lat: 46.1729, lng: 19.97481, name: 'Horgoš', to: 'Hungary' },
  Sid: { lat: 45.15471, lng: 19.17506, name: 'Šid', to: 'Croatia' },
  Gostun: { lat: 43.18513, lng: 19.76062, name: 'Gostun', to: 'Montenegro' },
  Kotroman: { lat: 43.76256, lng: 19.47011, name: 'Kotroman', to: 'Bosnia and Herzegovina' },
  MaliZvornik: { lat: 44.40345, lng: 19.12623, name: 'Mali Zvornik', to: 'Bosnia and Herzegovina' },
  SremskaRaca: { lat: 44.91689, lng: 19.30473, name: 'Sremska Rača', to: 'Bosnia and Herzegovina' },
  VrskaCuka: { lat: 43.85029, lng: 22.37889, name: 'Vrška Čuka', to: 'Bulgaria' },
  Gradina: { lat: 42.99924, lng: 22.82943, name: 'Gradina', to: 'Bulgaria' },
  Presevo: { lat: 42.23977, lng: 21.70243, name: 'Preševo', to: 'North Macedonia' },
};

export interface MupStream { folder: string; file: string; url: string }

const STREAM = /https:\/\/kamere\.mup\.gov\.rs:4443\/([A-Za-z]+)\/([a-z0-9]+)\.m3u8/g;

export function parseMupPage(html: string): MupStream[] {
  const out = new Map<string, MupStream>();
  for (const call of html.matchAll(/toggleCamera\(([^)]*)\)/g)) {
    for (const m of call[1].matchAll(STREAM)) {
      if (!out.has(m[0])) out.set(m[0], { folder: m[1], file: m[2], url: m[0] });
    }
  }
  return [...out.values()];
}

export function mapMupStream(s: MupStream): CctvCamera | null {
  const crossing = MUP_CROSSINGS[s.folder];
  if (!crossing) return null;
  const n = s.file.match(/(\d+)$/)?.[1];
  return {
    id: `mup-${s.file}`,
    lat: crossing.lat,
    lng: crossing.lng,
    name: `Border crossing ${crossing.name}${n ? ` (camera ${n})` : ''}`,
    city: `To ${crossing.to}`,
    country: 'Serbia',
    stream_url: s.url,
    stream_type: 'hls',
    external_url: PAGE,
    source: 'MUP Serbia',
  };
}

async function isLive(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) });
    return res.ok && (await res.text()).startsWith('#EXTM3U');
  } catch {
    return false;
  }
}

export async function fetchMupSerbiaCameras(): Promise<CctvCamera[]> {
  const res = await fetch(PAGE, { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`MUP Serbia cameras HTTP ${res.status}`);
  const streams = parseMupPage(await res.text());
  if (streams.length < 20) throw new Error(`MUP Serbia cameras: only ${streams.length} streams on the page`);

  const placed = streams.map(s => ({ s, cam: mapMupStream(s) })).filter((p): p is { s: MupStream; cam: CctvCamera } => p.cam !== null);
  const live: CctvCamera[] = [];
  for (let i = 0; i < placed.length; i += 6) {
    const batch = placed.slice(i, i + 6);
    const ok = await Promise.all(batch.map(p => isLive(p.s.url)));
    batch.forEach((p, j) => { if (ok[j]) live.push(p.cam); });
  }
  return live;
}
