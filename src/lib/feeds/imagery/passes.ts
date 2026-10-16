import { parseTLE, propagateSatrec } from '@/lib/feeds/satellites/orbit';
import { sunElevation } from '@/lib/feeds/weather/clouds/sunlight';
import { samplesIn } from './area';

/*
 * Satellite images of a place or an area: the recent passes of the free imaging satellites over it
 * (Microsoft Planetary Computer's STAC, keyless, CORS *), and when each satellite next flies over.
 * Terms: Copernicus Sentinel data and Landsat (USGS) allow commercial use with credit; Planetary
 * Computer's own terms of use still need checking before paid plans.
 */

export type ImagerKind = 'optical' | 'radar';

export interface Imager {
  name: string;
  /** NORAD catalogue number, as /api/satellites gives it. */
  norad: string;
  kind: ImagerKind;
  /** Ground size of a pixel. */
  resolution: string;
  /** Width of the strip it images, km. */
  swathKm: number;
  collection: string;
}

/** Keyed by STAC `platform`, lower-cased. */
export const IMAGERS: Record<string, Imager> = {
  'sentinel-2a': { name: 'Sentinel-2A', norad: '40697', kind: 'optical', resolution: '10 m', swathKm: 290, collection: 'sentinel-2-l2a' },
  'sentinel-2b': { name: 'Sentinel-2B', norad: '42063', kind: 'optical', resolution: '10 m', swathKm: 290, collection: 'sentinel-2-l2a' },
  'sentinel-2c': { name: 'Sentinel-2C', norad: '60989', kind: 'optical', resolution: '10 m', swathKm: 290, collection: 'sentinel-2-l2a' },
  'sentinel-1a': { name: 'Sentinel-1A', norad: '39634', kind: 'radar', resolution: '10 m', swathKm: 250, collection: 'sentinel-1-rtc' },
  'sentinel-1c': { name: 'Sentinel-1C', norad: '62261', kind: 'radar', resolution: '10 m', swathKm: 250, collection: 'sentinel-1-rtc' },
  'sentinel-1d': { name: 'Sentinel-1D', norad: '66315', kind: 'radar', resolution: '10 m', swathKm: 250, collection: 'sentinel-1-rtc' },
  'landsat-8': { name: 'Landsat 8', norad: '39084', kind: 'optical', resolution: '30 m', swathKm: 185, collection: 'landsat-c2-l2' },
  'landsat-9': { name: 'Landsat 9', norad: '49260', kind: 'optical', resolution: '30 m', swathKm: 185, collection: 'landsat-c2-l2' },
};

export const COLLECTIONS = ['sentinel-2-l2a', 'sentinel-1-rtc', 'landsat-c2-l2'] as const;

/** PC writes the same satellite as "Sentinel-2B", "sentinel-1c" and "landsat-9". */
export const normalizePlatform = (platform: unknown) => String(platform ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-');

export interface Scene {
  id: string;
  collection: string;
  platform: string;
  imager: Imager | undefined;
  /** Epoch ms. */
  time: number;
  /** Percent, for optical scenes. */
  cloud: number | null;
  /** XYZ template for MapLibre. */
  tiles: string | null;
  preview: string | null;
  footprint: GeoJSON.Geometry | null;
}

/** PC's tilejson link with the same rendering, as an XYZ template. */
export const tilesFromTilejson = (href: string) =>
  href.replace('/item/tilejson.json?', '/item/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?');

interface StacItem {
  id: string;
  collection?: string;
  geometry?: GeoJSON.Geometry | null;
  properties?: Record<string, unknown>;
  assets?: Record<string, { href?: string }>;
}

export function parseScenes(fc: { features?: StacItem[] }, collection: string): Scene[] {
  return (fc.features ?? []).flatMap(f => {
    const time = Date.parse(String(f.properties?.datetime ?? ''));
    if (!f.id || Number.isNaN(time)) return [];
    const platform = normalizePlatform(f.properties?.platform);
    const cloud = f.properties?.['eo:cloud_cover'];
    const tilejson = f.assets?.tilejson?.href;
    return [{
      id: f.id,
      collection: f.collection ?? collection,
      platform,
      imager: IMAGERS[platform],
      time,
      cloud: typeof cloud === 'number' ? cloud : null,
      tiles: tilejson ? tilesFromTilejson(tilejson) : null,
      preview: f.assets?.rendered_preview?.href ?? null,
      footprint: f.geometry ?? null,
    }];
  });
}

/** One row of the list: a pass of one satellite, or the clearest mix of several passes. */
export interface ScenePass {
  id: string;
  /** The clearest tile: the row's name, time and thumbnail. */
  lead: Scene;
  /** Every tile to draw, bottom to top. */
  tiles: Scene[];
  /** Mean over the tiles, for optical images. */
  cloud: number | null;
  /** Share of the area's ground the tiles cover, 0–1. */
  coverage: number;
  /** For the mix: how many passes it takes from, and their first and last times. */
  mix?: { passes: number; from: number; to: number };
}

/** Within a pass, Landsat and Sentinel-1 file a long strip as frames about 25 s apart. */
const PASS_GAP_MS = 120_000;

const meanCloud = (tiles: Scene[]) => {
  const c = tiles.flatMap(t => (t.cloud == null ? [] : [t.cloud]));
  return c.length ? c.reduce((a, b) => a + b, 0) / c.length : null;
};

const byCloud = (a: Scene, b: Scene) => (a.cloud ?? 101) - (b.cloud ?? 101) || b.time - a.time;

/** Newest first; each tile joins its satellite's pass when it comes within PASS_GAP_MS of the pass's last tile. */
function chainPasses(scenes: Scene[]): Scene[][] {
  const groups: Scene[][] = [];
  for (const s of [...scenes].sort((a, b) => b.time - a.time)) {
    const group = groups.find(g => g[0].platform === s.platform && g[g.length - 1].time - s.time < PASS_GAP_MS);
    if (group) group.push(s);
    else groups.push([s]);
  }
  return groups;
}

function covered(tiles: Scene[], samples: [number, number][]): number {
  const hit = new Set(tiles.flatMap(t => samplesIn(t.footprint, samples)));
  return samples.length ? hit.size / samples.length : 0;
}

/**
 * The scenes as passes, newest first: a pass is filed as one scene per tile (110 km for Sentinel-2), so
 * an area holds several of each. A pass that only grazes the search box and none of the area is dropped.
 */
export function groupPasses(scenes: Scene[], samples: [number, number][]): ScenePass[] {
  return chainPasses(scenes).flatMap(g => {
    const coverage = covered(g, samples);
    if (coverage === 0) return [];
    const tiles = [...g].sort(byCloud).reverse();
    return [{ id: tiles[tiles.length - 1].id, lead: tiles[tiles.length - 1], tiles, cloud: meanCloud(g), coverage }];
  });
}

/**
 * The area from its clearest optical tiles, whatever their date: the clearest tile first, then the clearest
 * that adds ground the others miss, until the area is covered. Null when one pass already does it.
 */
export function clearestMix(scenes: Scene[], samples: [number, number][], maxTiles = 30): ScenePass | null {
  const open = new Set(samples.keys());
  const picked: Scene[] = [];
  for (const s of scenes.filter(t => t.imager?.kind === 'optical' && t.tiles).sort(byCloud)) {
    if (!open.size || picked.length >= maxTiles) break;
    const adds = samplesIn(s.footprint, samples).filter(i => open.has(i));
    if (!adds.length) continue;
    adds.forEach(i => open.delete(i));
    picked.push(s);
  }
  const passes = chainPasses(picked).length;
  if (passes < 2) return null;
  const times = picked.map(t => t.time);
  return {
    id: 'clearest-mix',
    lead: picked[0],
    tiles: [...picked].reverse(),
    cloud: meanCloud(picked),
    coverage: samples.length ? 1 - open.size / samples.length : 0,
    mix: { passes, from: Math.min(...times), to: Math.max(...times) },
  };
}

const EARTH_R = 6371;
const RAD = Math.PI / 180;

export function groundKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * RAD, dLng = (lng2 - lng1) * RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface Pass {
  /** Epoch ms of the closest approach. */
  time: number;
  /** Ground distance from the place to the point under the satellite then. */
  offsetKm: number;
  /** Whether the sun is up at the place, which an optical image needs. */
  daylit: boolean;
}

const STEP_MS = 60_000;
/** A satellite covers about 420 km of ground a minute, so a coarse step can sample far from the closest point. */
const COARSE_SLACK_KM = 300;
const FINE_MS = 2_000;

/**
 * The satellite's next overflights of a place: the moments the point under it comes within half a
 * swath. An overflight is not a promised image; Sentinel-2 images only by day, Sentinel-1 to a plan.
 */
export function nextPasses(line1: string, line2: string, lat: number, lng: number, swathKm: number, from: number, days = 6, max = 3): Pass[] {
  const satrec = parseTLE(line1, line2);
  if (!satrec) return [];
  const distance = (t: number) => {
    const p = propagateSatrec(satrec, new Date(t));
    return p ? groundKm(lat, lng, p.lat, p.lng) : Infinity;
  };
  const reach = swathKm / 2;
  const passes: Pass[] = [];
  let prev = Infinity, falling = false;
  for (let t = from; t < from + days * 86_400_000 && passes.length < max; t += STEP_MS) {
    const d = distance(t);
    // The step before this one was the closest of its approach; find the true closest around it.
    if (falling && d > prev && prev <= reach + COARSE_SLACK_KM) {
      let best = { t: t - STEP_MS, d: prev };
      for (let u = t - 2 * STEP_MS; u <= t; u += FINE_MS) {
        const du = distance(u);
        if (du < best.d) best = { t: u, d: du };
      }
      if (best.d <= reach) passes.push({ time: best.t, offsetKm: Math.round(best.d), daylit: sunElevation(best.t)(lat * RAD, lng * RAD) > 0 });
    }
    falling = d < prev;
    prev = d;
  }
  return passes;
}
