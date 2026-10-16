import { bboxOf } from '@/lib/places/areas/aoi';
import type { Bbox } from './area';
import type { Scene } from './passes';

/*
 * One image of an area from a pass's tiles: Planetary Computer crops each tile to its share of the area
 * (item/bbox, in Web Mercator so it looks like the map), and a canvas stacks the crops into one PNG.
 */

/** About 64 MB of canvas; PC renders a 6000 px crop but a tab holding several gets slow. */
export const MAX_IMAGE_PX = 4096;
/** PC gives up after 15 s, which a 3000 px Landsat crop (three bands, colour formula) can take. */
const CHUNK_PX = 1024;

export interface CropPiece {
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropPlan {
  width: number;
  height: number;
  /** Bottom to top, as the tiles are drawn on the map; a big tile comes as several chunks. */
  pieces: CropPiece[];
}

const R = 6378137;
const RAD = Math.PI / 180;
const mx = (lng: number) => R * lng * RAD;
const my = (lat: number) => R * Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
const lngOf = (x: number) => x / R / RAD;
const latOf = (y: number) => (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) / RAD;

function footprintBox(g: GeoJSON.Geometry | null): Bbox | null {
  if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) return null;
  const rings = g.type === 'Polygon' ? [g.coordinates[0]] : g.coordinates.map(p => p[0]);
  const b = bboxOf(rings.flat());
  return [b.west, b.south, b.east, b.north];
}

/** The crop endpoint for a tile, with the tile layer's own rendering. */
const cropUrl = (tiles: string, box: Bbox, width: number, height: number) => {
  const [base, query] = tiles.split('?');
  const root = base.slice(0, base.indexOf('/item/tiles/'));
  return `${root}/item/bbox/${box.map(v => v.toFixed(6)).join(',')}/${width}x${height}.png?${query}&dst_crs=EPSG:3857`;
};

/**
 * Where each tile's piece of the area goes. Pixels are as fine as the sharpest imager allows, up to
 * MAX_IMAGE_PX on the long side, and every piece is snapped to whole pixels so the seams line up.
 */
export function cropPlan(tiles: Scene[], [w, s, e, n]: Bbox, maxPx = MAX_IMAGE_PX): CropPlan | null {
  const metres = Math.min(...tiles.map(t => parseFloat(t.imager?.resolution ?? '') || 30));
  const spanX = mx(e) - mx(w), spanY = my(n) - my(s);
  // A Mercator metre is cos(lat) ground metres.
  const native = Math.cos(((s + n) / 2) * RAD) / metres;
  const scale = Math.min(native, maxPx / Math.max(spanX, spanY));
  const width = Math.round(spanX * scale), height = Math.round(spanY * scale);
  if (width < 2 || height < 2) return null;
  const pieces = tiles.flatMap(t => {
    const fb = footprintBox(t.footprint);
    if (!t.tiles || !fb) return [];
    const x0 = Math.max(0, Math.floor((mx(Math.max(w, fb[0])) - mx(w)) * scale));
    const x1 = Math.min(width, Math.ceil((mx(Math.min(e, fb[2])) - mx(w)) * scale));
    const y0 = Math.max(0, Math.floor((my(n) - my(Math.min(n, fb[3]))) * scale));
    const y1 = Math.min(height, Math.ceil((my(n) - my(Math.max(s, fb[1]))) * scale));
    if (x1 - x0 < 2 || y1 - y0 < 2) return [];
    const out: CropPiece[] = [];
    for (let x = x0; x < x1; x += CHUNK_PX) {
      for (let y = y0; y < y1; y += CHUNK_PX) {
        const xe = Math.min(x1, x + CHUNK_PX), ye = Math.min(y1, y + CHUNK_PX);
        const box: Bbox = [lngOf(mx(w) + x / scale), latOf(my(n) - ye / scale), lngOf(mx(w) + xe / scale), latOf(my(n) - y / scale)];
        out.push({ url: cropUrl(t.tiles!, box, xe - x, ye - y), x, y, width: xe - x, height: ye - y });
      }
    }
    return out;
  });
  return pieces.length ? { width, height, pieces } : null;
}

/** One piece, tried twice: PC's renderers time out now and then under load. Null when both fail. */
async function fetchPiece(url: string, signal: AbortSignal): Promise<ImageBitmap | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { signal });
      if (res.ok) return await createImageBitmap(await res.blob());
    } catch (err) {
      if (signal.aborted) throw err;
    }
  }
  return null;
}

/** Fetches the pieces a few at a time and stacks them in order. `missing` counts pieces that failed. */
export async function renderCrop(plan: CropPlan, signal: AbortSignal, onProgress?: (done: number) => void): Promise<{ blob: Blob; missing: number }> {
  const canvas = document.createElement('canvas');
  canvas.width = plan.width;
  canvas.height = plan.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas');
  const ready: (ImageBitmap | null | undefined)[] = new Array(plan.pieces.length);
  let next = 0, drawn = 0, missing = 0;
  // Pieces arrive in any order but stack bottom to top, so draw each run that is complete.
  const flush = () => {
    while (drawn < ready.length && ready[drawn] !== undefined) {
      const bmp = ready[drawn], p = plan.pieces[drawn];
      if (bmp) { ctx.drawImage(bmp, p.x, p.y, p.width, p.height); bmp.close(); }
      ready[drawn++] = null;
    }
    onProgress?.(drawn);
  };
  const worker = async () => {
    while (next < plan.pieces.length) {
      const i = next++;
      ready[i] = await fetchPiece(plan.pieces[i].url, signal);
      if (!ready[i]) missing++;
      flush();
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, plan.pieces.length) }, worker));
  signal.throwIfAborted();
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not encode the image');
  return { blob, missing };
}
