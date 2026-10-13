import { areaParts, type AreaGeometry, type AreaPart } from './aoi';
import { cellBox, type FineLevel } from './boundaries';
import { TAKIP_UA } from '@/lib/httpJson';
import { simplifyLine } from '@/lib/reference/simplify';

/**
 * District and sub-district outlines from geoBoundaries (gbOpen), for the region pick.
 *
 * Each country's file is fetched the first time it is asked for, slimmed, and kept in memory; the
 * route then hands it out a cell at a time. gbOpen boundaries are openly licensed but the licence
 * varies by country (public domain, ODbL, OGL, Etalab…) and most ask for attribution, so the
 * source and licence travel with every response.
 */

const API = 'https://www.geoboundaries.org/api/current/gbOpen';
const GB_LEVEL: Record<FineLevel, string> = { admin2: 'ADM2', admin3: 'ADM3' };
const API_HOSTS = new Set(['www.geoboundaries.org']);
// The API points at GitHub, which redirects to its LFS host; nothing else is fetched.
const GEOMETRY_HOSTS = new Set(['github.com', 'media.githubusercontent.com', 'raw.githubusercontent.com']);
// Equator metres; simplifyLine scales it by latitude.
const TOLERANCE_M = 200;
const DECIMALS = 4;
const MAX_SETS = 6;

export interface FineFeature {
  feature: { type: 'Feature'; properties: { id: string; name: string }; geometry: AreaGeometry };
  parts: AreaPart[];
}

export interface FineSet {
  source: string;
  features: FineFeature[];
}

const round = (v: number) => Math.round(v * 10 ** DECIMALS) / 10 ** DECIMALS;

function slimRing(ring: number[][]): number[][] | null {
  const out: number[][] = [];
  for (const [x, y] of simplifyLine(ring, TOLERANCE_M)) {
    const p = [round(x), round(y)];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out.length >= 4 ? out : null;
}

/** geoBoundaries features down to id, name and a simplified outline; degenerate ones are dropped. */
export function slimFeatures(fc: { features?: GeoJSON.Feature[] }): FineFeature[] {
  const out: FineFeature[] = [];
  for (const f of fc.features ?? []) {
    const g = f.geometry;
    const p = f.properties ?? {};
    if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) continue;
    const id = typeof p.shapeID === 'string' ? p.shapeID : null;
    const name = typeof p.shapeName === 'string' ? p.shapeName.trim() : '';
    if (!id || !name) continue;
    const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    const kept: number[][][][] = [];
    for (const rings of polygons) {
      const outer = rings[0] && slimRing(rings[0]);
      if (!outer) continue;
      kept.push([outer, ...rings.slice(1).map(slimRing).filter((r): r is number[][] => r !== null)]);
    }
    if (!kept.length) continue;
    const geometry: AreaGeometry = kept.length === 1
      ? { type: 'Polygon', coordinates: kept[0] }
      : { type: 'MultiPolygon', coordinates: kept };
    out.push({ feature: { type: 'Feature', properties: { id, name }, geometry }, parts: areaParts(geometry) });
  }
  return out;
}

/** The features with a part overlapping the cell; one spanning several cells is in each. */
export function featuresInCell(set: FineSet, cell: string): FineFeature['feature'][] {
  const box = cellBox(cell);
  if (!box) return [];
  return set.features
    .filter(f => f.parts.some(({ box: b }) => b.west <= box.east && b.east >= box.west && b.south <= box.north && b.north >= box.south))
    .map(f => f.feature);
}

interface GbMeta {
  simplifiedGeometryGeoJSON?: string;
  boundarySource?: string;
  boundaryLicense?: string;
}

export function creditLine(meta: GbMeta): string {
  return ['geoBoundaries', meta.boundarySource, meta.boundaryLicense].filter(s => s && s.trim()).join(' · ');
}

async function getJson(url: string, hosts: Set<string>, timeoutMs: number): Promise<{ status: number; body: unknown }> {
  if (!hosts.has(new URL(url).hostname)) throw new Error(`Refusing to fetch ${url}`);
  const res = await fetch(url, {
    headers: { 'User-Agent': TAKIP_UA, Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.url && !hosts.has(new URL(res.url).hostname)) {
    await res.body?.cancel();
    throw new Error(`Redirected off the allowed hosts to ${res.url}`);
  }
  if (!res.ok) {
    await res.body?.cancel();
    return { status: res.status, body: null };
  }
  return { status: res.status, body: await res.json() };
}

async function fetchSet(iso3: string, level: FineLevel): Promise<FineSet | null> {
  const meta = await getJson(`${API}/${iso3}/${GB_LEVEL[level]}/`, API_HOSTS, 20_000);
  if (meta.status === 404) return null;
  if (meta.status !== 200) throw new Error(`geoBoundaries ${iso3} ${level}: HTTP ${meta.status}`);
  const info = meta.body as GbMeta;
  const url = info.simplifiedGeometryGeoJSON;
  if (!url) throw new Error(`geoBoundaries ${iso3} ${level}: no geometry link`);
  const geo = await getJson(url, GEOMETRY_HOSTS, 120_000);
  if (geo.status !== 200) throw new Error(`geoBoundaries ${iso3} ${level} geometry: HTTP ${geo.status}`);
  return { source: creditLine(info), features: slimFeatures(geo.body as { features?: GeoJSON.Feature[] }) };
}

// Least recently used first; a failed load is dropped so the next request retries.
const sets = new Map<string, Promise<FineSet | null>>();

export function loadFineSet(iso3: string, level: FineLevel): Promise<FineSet | null> {
  const key = `${iso3}|${level}`;
  let p = sets.get(key);
  if (p) {
    sets.delete(key);
  } else {
    p = fetchSet(iso3, level).catch(err => {
      sets.delete(key);
      throw err;
    });
  }
  sets.set(key, p);
  while (sets.size > MAX_SETS) sets.delete(sets.keys().next().value!);
  return p;
}
