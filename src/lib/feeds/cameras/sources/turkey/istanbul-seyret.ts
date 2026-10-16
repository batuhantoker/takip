import type { CctvCamera } from '@/lib/feeds/cameras/types';
import type { Bounds } from '@/lib/feeds/cameras/sources/platforms/cars';

/**
 * TAKIP — İBB's tourism cameras ("İstanbul'u Seyret"): landmark views with CORS-open HLS on kamerayayin.ibb.istanbul.
 * The list page names the cameras but not their streams, which sit in each camera page's script, so streams and
 * positions are kept here (read 2026-10-13) and the list page decides what is shown.
 * KVKK: since June 2026 İBB has taken cameras off air for personal-data protection, leaving a notice on the list
 * (Kadıköy, Mısır Çarşısı, Miniatürk, Sultanahmet as of 2026-10-13). Those, and anything no longer listed, are skipped.
 * Terms: pending — none published; the site reserves all rights to İBB.
 */

const SITE = 'https://istanbuluseyret.ibb.istanbul';
const LIST_PAGE = `${SITE}/tr/turistik-kameralar`;
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
const KVKK_NOTICE = 'kişisel verilerin korunması';
export const ISTANBUL_SEYRET_BOUNDS: Bounds = { minLat: 40.8, maxLat: 41.2, minLng: 28.9, maxLng: 29.2 };

/** By list-page slug; `stream` is the name before `.stream` in the camera page's videoSrc. */
const CAMERAS: Record<string, { name: string; stream: string; lat: number; lng: number }> = {
  // Its page has no map; the fortress itself.
  'anadolu-hisari': { name: 'Anadolu Hisarı', stream: 'anadoluhisari', lat: 41.0823, lng: 29.0666 },
  'beyazit-kulesi-2': { name: 'Beyazıt Kulesi 2', stream: 'beyazitkulesi2', lat: 41.0128, lng: 28.96492 },
  'beyazit-meydani': { name: 'Beyazıt Meydanı', stream: 'beyazitmeydan', lat: 41.01029, lng: 28.96598 },
  'buyuk-camlica': { name: 'Büyük Çamlıca', stream: 'buyukcamlica', lat: 41.02718, lng: 29.06807 },
  'dragos': { name: 'Dragos', stream: 'dragos', lat: 40.9081, lng: 29.14418 },
  'eminonu': { name: 'Eminönü', stream: 'eminonu', lat: 41.01905, lng: 28.97017 },
  'emirgan': { name: 'Emirgan', stream: 'emirgan', lat: 41.10584, lng: 29.05515 },
  'eyup-sultan': { name: 'Eyüp Sultan', stream: 'eyupsultan', lat: 41.04704, lng: 28.93478 },
  'hidiv-kasri': { name: 'Hidiv Kasrı', stream: 'hidivkasri', lat: 41.10548, lng: 29.07291 },
  'kiz-kulesi': { name: 'Kız Kulesi', stream: 'kizkulesi', lat: 41.02391, lng: 29.00346 },
  'pierre-loti': { name: 'Pierre Loti', stream: 'pierreloti', lat: 41.05377, lng: 28.93709 },
  'salacak': { name: 'Salacak', stream: 'salacak', lat: 41.01736, lng: 29.00785 },
  'sarachane': { name: 'Saraçhane', stream: 'sarachane', lat: 41.01225, lng: 28.95538 },
  'sultanahmet-2': { name: 'Sultanahmet 2', stream: 'sultanahmet2', lat: 41.00681, lng: 28.97899 },
  'taksim-meydan': { name: 'Taksim Meydanı', stream: 'taksim', lat: 41.03797, lng: 28.98642 },
  'ulus-parki': { name: 'Ulus Parkı', stream: 'ulusparki', lat: 41.05514, lng: 29.03288 },
  'uskudar': { name: 'Üsküdar', stream: 'uskudar', lat: 41.02704, lng: 29.01595 },
};

/** Slugs on the list page whose entry carries no KVKK notice. */
export function parseSeyretList(html: string): string[] {
  const blocks = html.split('<div class="row kamera-item-list').slice(1);
  if (!blocks.length) throw new Error("İstanbul'u Seyret: no cameras on the list page");
  const live: string[] = [];
  for (const block of blocks) {
    const slug = block.match(/\/turistik-kamera\/([a-z0-9-]+)"/)?.[1];
    // Only the entry's own text: the page footer links İBB's data-protection policy.
    const text = block.match(/<p class="kamera-content[^"]*">([\s\S]*?)<\/p>/)?.[1] ?? '';
    // Turkish lower-casing, so an upper-case "KİŞİSEL" still matches.
    if (slug && !text.toLocaleLowerCase('tr').includes(KVKK_NOTICE) && !live.includes(slug)) live.push(slug);
  }
  return live;
}

export function seyretCameras(slugs: string[]): CctvCamera[] {
  return slugs.flatMap(slug => {
    const cam = CAMERAS[slug];
    if (!cam) return [];
    return [{
      id: `tr-seyret-${slug}`,
      lat: cam.lat,
      lng: cam.lng,
      name: cam.name,
      city: 'Istanbul',
      country: 'Turkey',
      stream_url: `https://kamerayayin.ibb.istanbul/turistikcam/${cam.stream}.stream/playlist.m3u8`,
      stream_type: 'hls' as const,
      external_url: `${SITE}/tr/turistik-kamera/${slug}`,
      source: "İBB İstanbul'u Seyret",
    }];
  });
}

export async function fetchIstanbulSeyretCameras(): Promise<CctvCamera[]> {
  const res = await fetch(LIST_PAGE, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`İstanbul'u Seyret HTTP ${res.status}`);

  const slugs = parseSeyretList(await res.text());
  const unknown = slugs.filter(s => !CAMERAS[s]);
  const cams = seyretCameras(slugs);
  console.log(`[TAKIP] Istanbul cameras — İstanbul'u Seyret: ${cams.length}${unknown.length ? ` (not mapped yet: ${unknown.join(', ')})` : ''}`);
  return cams;
}
