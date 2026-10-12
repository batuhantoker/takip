import type { CctvCamera } from '@/lib/cctv/types';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * TAKIP — Bayern Info road cameras (~420 on Bavarian federal, state and city roads): the keyless list behind
 * bayerninfo.de's traffic map, no key.
 * Terms: personal, non-commercial use only; republishing needs the Bavarian transport ministry's consent
 * (bayerninfo.de Nutzungsbedingungen §3, §5).
 *
 * The same list also carries ASFINAG's Austrian cameras under `asfinag/`; ./asfinag owns those.
 */

const API = 'https://map.bayerninfo.de/cam/listOfWebcamsV3.json';
const IMAGE_BASE = 'https://map.bayerninfo.de/cam';
const SOURCE = 'Bayern Info';
/** Only Bayern Info's own stills; the image path is joined onto IMAGE_BASE, so nothing else may get through. */
const OWN_IMAGE = /^bi\/jpg\/[\w.,-]+\.jpg$/;
const REGIERUNGSBEZIRKE = new Set([
  'Oberbayern', 'Niederbayern', 'Oberpfalz', 'Oberfranken', 'Mittelfranken', 'Unterfranken', 'Schwaben',
]);

export const BAYERNINFO_BOUNDS = { minLat: 47.2, maxLat: 50.7, minLng: 8.9, maxLng: 13.9 };

export interface BayernInfoWebcam {
  id?: number | null;
  lat?: number | null;
  lon?: number | null;
  /** Relative to IMAGE_BASE. */
  url?: string | null;
  route?: string | null;
  direction?: string | null;
}

export interface BayernInfoGroup {
  title_de?: string | null;
  groups?: BayernInfoGroup[] | null;
  webcams?: BayernInfoWebcam[] | null;
}

const clean = (s: string | null | undefined) => s?.replace(/\s+/g, ' ').trim() ?? '';

/** Groups are a road (`B2`), a Regierungsbezirk, or `Stadt Augsburg`. */
function cityOf(group: string): string {
  if (group.startsWith('Stadt ')) return group.slice(6).trim();
  return REGIERUNGSBEZIRKE.has(group) ? group : 'Bavaria';
}

export function mapBayernInfoWebcam(cam: BayernInfoWebcam | null | undefined, group = ''): CctvCamera | null {
  const id = cam?.id;
  const path = cam?.url?.trim();
  if (!Number.isInteger(id) || !path || !OWN_IMAGE.test(path)) return null;

  const { lat, lon } = cam!;
  if (typeof lat !== 'number' || typeof lon !== 'number' || (lat === 0 && lon === 0)) return null;
  const b = BAYERNINFO_BOUNDS;
  if (lat < b.minLat || lat > b.maxLat || lon < b.minLng || lon > b.maxLng) return null;

  const route = clean(cam!.route) || `${SOURCE} Camera ${id}`;
  const direction = clean(cam!.direction);
  return {
    id: `bayerninfo-${id}`,
    lat,
    lng: lon,
    name: direction && !route.includes(direction) ? `${route} → ${direction}` : route,
    city: cityOf(clean(group)),
    country: 'Germany',
    feed_url: `${IMAGE_BASE}/${path}`,
    external_url: `https://www.bayerninfo.de/de/verkehrskameras?feature=camera/${id}`,
    source: SOURCE,
  };
}

/** Every webcam in the tree, with the title of the group that lists it. */
export function flattenGroups(groups: BayernInfoGroup[] | null | undefined): [BayernInfoWebcam, string][] {
  const out: [BayernInfoWebcam, string][] = [];
  const walk = (g: BayernInfoGroup) => {
    for (const cam of g?.webcams ?? []) out.push([cam, g.title_de ?? '']);
    for (const sub of g?.groups ?? []) walk(sub);
  };
  for (const g of groups ?? []) walk(g);
  return out;
}

export async function fetchBayernInfoCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(API, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Bayern Info HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data?.groups)) throw new Error('Bayern Info: no groups in response');

  const seen = new Map<string, CctvCamera>();
  for (const [cam, group] of flattenGroups(data.groups)) {
    const mapped = mapBayernInfoWebcam(cam, group);
    if (mapped && !seen.has(mapped.id)) seen.set(mapped.id, mapped);
  }
  console.log(`[TAKIP] Bayern Info cameras — ${SOURCE}: ${seen.size}`);
  return [...seen.values()];
}
