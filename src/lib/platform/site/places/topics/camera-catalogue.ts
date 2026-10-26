import { readFileSync, statSync } from 'node:fs';
import { snapshotPath } from '@/lib/feeds/cameras/catalog/snapshot';
import { previewMedia } from '@/lib/feeds/cameras/preview';
import { km } from '../gazetteer';

/**
 * The camera catalogue as the app last saved it (.cache/cctv-catalog.json, rebuilt in the background), cut down to
 * what place pages need and indexed on a half-degree grid. Read again when the file changes, at most every 10 minutes.
 */

export interface CatalogueCamera {
  name: string; lat: number; lng: number; source: string; offline: boolean;
  /** What it shows: a still a page can show as it is (`frame`), video on the map, or nothing beyond a link. */
  look?: CameraLook;
  frame?: string;
  /** Video a page can play when asked. */
  stream?: CameraStream;
}

export interface CameraStream { kind: 'hls' | 'mp4'; url: string }

/** `still`: a snapshot the map tiles and pages show; `stream`: video in a map tile; `player`: video in the map's window only. */
export type CameraLook = 'still' | 'stream' | 'player';

/** Hosts that answer every still with one "no live feed" picture (nvroads.com, all 24 on 2026-10-26). */
const PLACEHOLDER_STILLS = /^https:\/\/www\.nvroads\.com\/map\/Cctv\//;

/** Read with the map tiles' own rule (preview.ts), so a page shows what the map does. */
function lookOf(c: Record<string, unknown>): { look?: CameraLook; frame?: string; stream?: CameraStream } {
  const media = previewMedia({
    stream_type: typeof c.stream_type === 'string' ? c.stream_type : undefined,
    feed_url: typeof c.feed_url === 'string' ? c.feed_url : undefined,
    stream_url: typeof c.stream_url === 'string' ? c.stream_url : undefined,
  });
  if (media?.kind === 'jpg') return PLACEHOLDER_STILLS.test(media.url) ? {} : { look: 'still', frame: media.url };
  if (media?.kind === 'hls' || media?.kind === 'mp4') return { look: 'stream', stream: { kind: media.kind, url: media.url } };
  if (media) return { look: 'stream' };
  return c.stream_type === 'iframe' && c.stream_url ? { look: 'player' } : {};
}

const RECHECK_MS = 10 * 60_000;
const cellOf = (lat: number, lng: number) => `${Math.floor(lat * 2)},${Math.floor(lng * 2)}`;

let held: { mtime: number; checked: number; builtAt: number; grid: Map<string, CatalogueCamera[]> } | null = null;

function load() {
  const now = Date.now();
  if (held && now - held.checked < RECHECK_MS) return held;
  let mtime: number;
  try {
    mtime = statSync(snapshotPath()).mtimeMs;
  } catch {
    held = null;
    return null;
  }
  if (held && held.mtime === mtime) {
    held.checked = now;
    return held;
  }
  const file = JSON.parse(readFileSync(snapshotPath(), 'utf8')) as { builtAt?: number; regions?: Record<string, Record<string, unknown>[]> };
  const grid = new Map<string, CatalogueCamera[]>();
  for (const cams of Object.values(file.regions ?? {})) for (const c of cams) {
    const lat = Number(c.lat), lng = Number(c.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const cam: CatalogueCamera = { name: String(c.name ?? ''), lat, lng, source: String(c.source ?? ''), offline: c.offline === true, ...lookOf(c) };
    const k = cellOf(lat, lng);
    const list = grid.get(k);
    if (list) list.push(cam);
    else grid.set(k, [cam]);
  }
  held = { mtime, checked: now, builtAt: file.builtAt ?? mtime, grid };
  return held;
}

/** Cameras within `radiusKm` (under 50) of a point, nearest first; null when the app has no catalogue saved. */
export function camerasNear(at: [number, number], radiusKm: number): { cameras: (CatalogueCamera & { km: number })[]; builtAt: number } | null {
  const cat = load();
  if (!cat) return null;
  const [lng, lat] = at;
  const out: (CatalogueCamera & { km: number })[] = [];
  // Half a degree of longitude narrows towards the poles, so more cells are searched east and west.
  const nx = Math.ceil(radiusKm / (55.66 * Math.cos((lat * Math.PI) / 180)));
  for (let dy = -1; dy <= 1; dy++) for (let dx = -nx; dx <= nx; dx++) {
    for (const c of cat.grid.get(cellOf(lat + dy / 2, lng + dx / 2)) ?? []) {
      const d = km(at, [c.lng, c.lat]);
      if (d <= radiusKm) out.push({ ...c, km: d });
    }
  }
  return { cameras: out.sort((a, b) => a.km - b.km), builtAt: cat.builtAt };
}
