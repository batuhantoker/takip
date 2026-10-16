import sharp, { type OverlayOptions } from 'sharp';
import { createPool } from '@/lib/core/net/fetch-pool';
import { textureGrid } from '@/lib/space/bodies/texture-grid';
import { TEXTURES, type TextureId } from '@/lib/space/worlds';

/**
 * TAKIP — whole-globe equirectangular textures for the space view, stitched
 * from NASA Trek (Moon, Mars) and NASA GIBS (Earth) tiles. Imagery is static,
 * so each texture is built once per process and cached by the browser for good.
 */

const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
const OUT_WIDTH = { low: 2048, high: 4096 } as const;
export type Detail = keyof typeof OUT_WIDTH;

const pool = createPool(6);
const built = new Map<string, Promise<Buffer>>();

async function tile(url: string): Promise<Buffer | null> {
  return pool.run(async () => {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${new URL(url).host} HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  });
}

async function build(id: TextureId, detail: Detail): Promise<Buffer> {
  const { source } = TEXTURES[id];
  const level = source.levels[detail];
  const g = textureGrid(source, level);
  const jobs: Promise<OverlayOptions | null>[] = [];
  for (let row = 0; row < g.rows; row++) {
    for (let col = 0; col < g.cols; col++) {
      jobs.push(tile(source.url(level, row, col)).then(input => input && { input, left: col * source.tileSize, top: row * source.tileSize }));
    }
  }
  const overlays = (await Promise.all(jobs)).filter((o): o is OverlayOptions => o !== null);
  // sharp composites after any crop in the same pipeline, so stitch first, then crop.
  const mosaic = await sharp({ create: { width: g.cols * source.tileSize, height: g.rows * source.tileSize, channels: 3, background: '#000' } })
    .composite(overlays).png({ compressionLevel: 0 }).toBuffer();
  const width = Math.min(OUT_WIDTH[detail], g.width);
  return sharp(mosaic).extract({ left: 0, top: 0, width: g.width, height: g.height })
    .resize(width, width / 2).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
}

export function bodyTexture(id: TextureId, detail: Detail): Promise<Buffer> {
  const key = `${id}:${detail}`;
  let hit = built.get(key);
  if (!hit) {
    hit = build(id, detail);
    hit.catch(() => built.delete(key));
    built.set(key, hit);
  }
  return hit;
}
