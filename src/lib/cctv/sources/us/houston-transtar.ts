import { cachedSource } from '@/lib/sourceCache';
import type { CctvCamera } from '@/lib/cctv/types';

const BASE = 'https://traffic.houstontranstar.org';

export interface TranstarListing {
  road: string;
  name: string;
  id: string;
}

function normalName(value: string): string {
  return value.toLowerCase().replaceAll('&amp;', 'and').replace(/[^a-z0-9]/g, '');
}

export function parseTranstarRoads(html: string): string[] {
  return [...new Set([...html.matchAll(/roadway=([^"'&<>]+)/g)].map(match => match[1]))];
}

export function parseTranstarCameras(road: string, html: string): TranstarListing[] {
  return [...html.matchAll(/cam=([^"'&<>]+)(?:&amp;|&)id=(\d+)/g)].map(match => ({
    road,
    name: decodeURIComponent(match[1]).replaceAll('_', ' '),
    id: match[2],
  }));
}

/**
 * TxDOT publishes coordinates for Houston and eastern Yoakum cameras, but its snapshot API
 * answers JSON null for those networks, even for rows marked online.
 * TranStar publishes working JPEGs by numeric id. Join only exact, unique
 * roadway + camera labels so a frame is never placed at the wrong intersection.
 */
export function matchHoustonTranstarCameras(txdot: CctvCamera[], listings: TranstarListing[]): CctvCamera[] {
  const index = new Map<string, TranstarListing | null>();
  for (const listing of listings) {
    const key = normalName(`${listing.road} @ ${listing.name}`);
    const previous = index.get(key);
    if (previous && previous.id !== listing.id) index.set(key, null);
    else if (!index.has(key)) index.set(key, listing);
  }

  return txdot.flatMap(camera => {
    const match = index.get(normalName(camera.name));
    if (!match) return [];
    return [{
      ...camera,
      source: 'Houston TranStar',
      feed_url: `${BASE}/snapshots/cctv/${match.id}.jpg`,
      external_url: `${BASE}/mobile/itranstar_cctv.aspx?roadway=${encodeURIComponent(match.road)}`,
    }];
  });
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Houston TranStar HTTP ${response.status}`);
  return response.text();
}

export const fetchHoustonTranstarIndex = cachedSource('houstontranstar:index', async (): Promise<TranstarListing[]> => {
  const home = await fetchPage(`${BASE}/mobile/itranstar_cctv.aspx`);
  const roads = parseTranstarRoads(home);
  if (roads.length < 20) throw new Error('Houston TranStar road list is incomplete');
  const pages = await Promise.all(roads.map(async road => ({
    road,
    html: await fetchPage(`${BASE}/mobile/itranstar_cctv.aspx?roadway=${encodeURIComponent(road)}`),
  })));
  const cameras = pages.flatMap(page => parseTranstarCameras(page.road, page.html));
  if (cameras.length < 300) throw new Error('Houston TranStar camera list is incomplete');
  return cameras;
});

/*
 * City of Houston GIS publishes TranStar camera sites with coordinates (no licence stated; operator
 * is TranStar). It places listed cameras the TxDOT name join cannot, ~140 more on 2026-10-12.
 * Only ids TranStar still lists are used: some sites in the layer have frames weeks old.
 */
const SITES_URL = 'https://services.arcgis.com/NummVBqZSIJKUeVR/arcgis/rest/services/Trantar_Camera_Locations/FeatureServer/0/query'
  + '?where=1%3D1&outFields=cctv,Name,latitude,longitude&outSR=4326&f=json';
const HOUSTON_BOUNDS = { minLat: 28.8, maxLat: 30.9, minLng: -96.6, maxLng: -94.3 };

export interface TranstarSite { id: string; name: string; lat: number; lng: number }

export function mapTranstarSite(a: { cctv?: unknown; Name?: unknown; latitude?: unknown; longitude?: unknown } | null | undefined): TranstarSite | null {
  const id = typeof a?.cctv === 'string' || typeof a?.cctv === 'number' ? String(a.cctv).trim() : '';
  const lat = a?.latitude;
  const lng = a?.longitude;
  if (!/^\d+$/.test(id) || typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (lat < HOUSTON_BOUNDS.minLat || lat > HOUSTON_BOUNDS.maxLat || lng < HOUSTON_BOUNDS.minLng || lng > HOUSTON_BOUNDS.maxLng) return null;
  return { id, name: typeof a?.Name === 'string' && a.Name.trim() ? a.Name.trim() : `TranStar Camera ${id}`, lat, lng };
}

/** Listed TranStar cameras the join left unplaced, at the City of Houston's coordinates. */
export function placeUnmatchedTranstar(joined: CctvCamera[], listings: TranstarListing[], sites: TranstarSite[]): CctvCamera[] {
  const used = new Set(joined.map(c => c.feed_url?.match(/\/snapshots\/cctv\/(\d+)\.jpg$/)?.[1]).filter(Boolean));
  const listed = new Map(listings.map(l => [l.id, l]));
  const seen = new Set<string>();
  return sites.flatMap(site => {
    const listing = listed.get(site.id);
    if (!listing || used.has(site.id) || seen.has(site.id)) return [];
    seen.add(site.id);
    return [{
      id: `transtar-${site.id}`,
      lat: site.lat,
      lng: site.lng,
      name: site.name,
      city: 'Houston',
      country: 'US',
      source: 'Houston TranStar',
      stream_type: 'jpg' as const,
      feed_url: `${BASE}/snapshots/cctv/${site.id}.jpg`,
      external_url: `${BASE}/mobile/itranstar_cctv.aspx?roadway=${encodeURIComponent(listing.road)}`,
    }];
  });
}

export const fetchHoustonTranstarSites = cachedSource('houstontranstar:sites', async (): Promise<TranstarSite[]> => {
  const json = JSON.parse(await fetchPage(SITES_URL)) as { error?: unknown; features?: { attributes?: Record<string, unknown> }[] };
  if (json.error || !Array.isArray(json.features)) throw new Error('Houston TranStar sites: unexpected response');
  const sites = json.features.map(f => mapTranstarSite(f.attributes)).filter((s): s is TranstarSite => s !== null);
  if (sites.length < 300) throw new Error(`Houston TranStar sites: only ${sites.length}`);
  return sites;
});
