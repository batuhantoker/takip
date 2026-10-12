import type { CctvCamera } from '@/lib/cctv/types';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * TAKIP — Időkép member weather webcams (~620, mostly Hungary), from the markers on idokep.hu's own webcam map,
 * no key.
 * Terms: downloading, storing, processing or republishing site content on other media needs Időkép Kft.'s prior
 * written consent; commercial use is prohibited (idokep.hu ÁSZF §3, §10).
 *
 * Members run these cameras; the ÁSZF (§7.1) bars them from showing people or private property. The still is the
 * map's 236×180 thumbnail: the full frame needs a per-page token.
 */

const MAP_PAGE = 'https://www.idokep.hu/webkamera';
const LIST_PAGE = 'https://www.idokep.hu/webkamera/mindegyik';
const SOURCE = 'Időkép';

export const IDOKEP_BOUNDS = { minLat: 41, maxLat: 54, minLng: -1, maxLng: 26 };

export interface IdokepMarker {
  user: string;
  lat: number;
  lng: number;
}

const MARKER = /new L\.marker\(\[(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\][^\n]*?datasrc="\/\/cam\.idokep\.hu\/cam\/([\w.-]+)\/thumbnail\.jpg"/g;
const PLACE = /user="([\w.-]+)">\s*<div class="ik kamera-ajanlo-container">[\s\S]{0,300}?<span>([^<]*)<\/span>/g;

export function parseMarkers(html: string): IdokepMarker[] {
  return [...html.matchAll(MARKER)].map(m => ({ user: m[3], lat: Number(m[1]), lng: Number(m[2]) }));
}

/** Member handle → place caption, from the all-cameras listing. */
export function parsePlaces(html: string): Map<string, string> {
  const places = new Map<string, string>();
  for (const m of html.matchAll(PLACE)) {
    const place = m[2].replace(/\s+/g, ' ').trim();
    if (place && !places.has(m[1])) places.set(m[1], place);
  }
  return places;
}

export function mapIdokepMarker(m: IdokepMarker, place = ''): CctvCamera | null {
  const user = m?.user;
  if (!user || !/^[\w.-]+$/.test(user) || /^\.+$/.test(user)) return null;

  const { lat, lng } = m;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  const b = IDOKEP_BOUNDS;
  if (lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng) return null;

  return {
    id: `idokep-${user}`,
    lat,
    lng,
    name: place || user,
    city: place,
    country: '',
    feed_url: `https://cam.idokep.hu/cam/${user}/thumbnail.jpg`,
    external_url: `https://www.idokep.hu/webkamera/${user}`,
    source: SOURCE,
  };
}

async function getHtml(url: string): Promise<string> {
  const res = await stealthFetch(url, { signal: AbortSignal.timeout(12000), headers: { Accept: 'text/html' } });
  if (!res.ok) throw new Error(`Időkép HTTP ${res.status}`);
  return res.text();
}

export async function fetchIdokepCameras(): Promise<CctvCamera[]> {
  const [mapHtml, listHtml] = await Promise.all([getHtml(MAP_PAGE), getHtml(LIST_PAGE)]);
  const markers = parseMarkers(mapHtml);
  if (!markers.length) throw new Error('Időkép: no markers on the webcam map');
  const places = parsePlaces(listHtml);

  const seen = new Map<string, CctvCamera>();
  for (const m of markers) {
    const cam = mapIdokepMarker(m, places.get(m.user));
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] Weather webcams — ${SOURCE}: ${seen.size}`);
  return [...seen.values()];
}
