import type { CctvCamera } from '@/lib/cctv/types';
import { loadIbi511Cameras, type Ibi511Source } from '@/lib/cctv/sources/platforms/ibi511';
import { fetchCalgaryCameras } from './calgary';

/**
 * TAKIP — Alberta 511 cameras (~148 of 337 once Calgary's are dropped): the list behind 511.alberta.ca's own camera
 * page, no key. `/api/v2/get/cameras` answers "Invalid Key" without a developer key.
 */
export const AB511: Ibi511Source = {
  base: 'https://511.alberta.ca',
  idPrefix: 'ab',
  source: 'Alberta 511',
  state: 'Alberta',
  country: 'Canada',
  // Answers 500 to a larger page.
  pageSize: 50,
  bounds: { minLat: 48.9, maxLat: 60.1, minLng: -120.1, maxLng: -109.9 },
};

/** Row owners that re-serve City of Calgary cameras; the provincial RWIS (`WOOD`) and `Parks` rows never do. */
const CITY_OWNERS = new Set(['Calgary', 'Alberta511', 'USER']);
const NEAR_M = 150;
const SAME_NAME_M = 2000;

function metres(a: CctvCamera, b: CctvCamera): number {
  const dLat = (a.lat - b.lat) * 111_320;
  const dLng = (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bavenue\b/g, 'ave'], [/\bstreet\b/g, 'st'], [/\broad\b/g, 'rd'], [/\btrail\b/g, 'tr'],
  [/\bdrive\b/g, 'dr'], [/\bboulevard\b/g, 'blvd'], [/\b(and|at)\b/g, ''],
];

export function intersectionKey(name: string): string {
  let s = name.toLowerCase();
  for (const [re, short] of ABBREVIATIONS) s = s.replace(re, short);
  return s.replace(/[^a-z0-9]/g, '');
}

/**
 * Alberta 511's copies of City of Calgary cameras are byte-identical frames under the same names, but placed up to a
 * few hundred metres apart, so they are matched by name as well as distance.
 */
export function albertaSource(city: CctvCamera[]): Ibi511Source {
  const names = new Map<string, CctvCamera[]>();
  for (const c of city) {
    const key = intersectionKey(c.name);
    names.set(key, [...(names.get(key) ?? []), c]);
  }
  const isCityCamera = (p: CctvCamera) =>
    city.some(c => metres(p, c) < NEAR_M) ||
    (names.get(intersectionKey(p.name)) ?? []).some(c => metres(p, c) < SAME_NAME_M);
  return { ...AB511, drop: (cam, rec) => CITY_OWNERS.has(rec.source ?? '') && isCityCamera(cam) };
}

export async function fetchAlbertaCameras(): Promise<CctvCamera[]> {
  // Without Calgary's list every camera is kept: doubled markers beat missing ones.
  const city = await fetchCalgaryCameras().catch(() => []);
  return loadIbi511Cameras(albertaSource(city));
}
