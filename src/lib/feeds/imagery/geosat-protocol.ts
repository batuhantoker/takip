import type { AddProtocolAction } from 'maplibre-gl';
import { sunElevation } from '@/lib/feeds/weather/clouds/sunlight';
import { tileBbox } from '@/lib/feeds/weather/clouds/tiles';
import {
  BLACK_MARBLE, BLACK_MARBLE_DATE, BLUE_MARBLE, GOES_EAST, GOES_WEST, HIMAWARI_IR, HIMAWARI_VIS,
  latestFrame, staticTileUrl, tenMinutes, tileUrl, type GibsProduct,
} from './gibs';
import { SECTORS, composeGeoColor, sectorColumns, wmsLatestTime, type SatId, type Sector } from './geostationary';

/*
 * `geosat://{sector}/{time}/{z}/{x}/{y}`: one band of the geostationary ring (lib/feeds/imagery/geostationary),
 * fetched from its satellite and cut to its own longitudes, so the four bands meet without overlapping.
 */

const PROTOCOL = 'geosat';
const TILE = 256;
export const MTG_WMS = 'https://view.eumetsat.int/geoserver/mtg_fd/wms';
export const MTG_CAPABILITIES = 'https://view.eumetsat.int/geoserver/mtg_fd/rgb_geocolour/ows?service=WMS&version=1.3.0&request=GetCapabilities';
/** MTG's newest frame trails real time by about 30 minutes; this is the guess when it can't be asked. */
const MTG_LAG_MS = 40 * 60_000;

export const geosatTiles = (id: SatId, time: string) => `${PROTOCOL}://${id}/${time}/{z}/{x}/{y}`;

const xyz = (template: string, z: number, x: number, y: number) =>
  template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));

/** The newest frame a band's satellite has published. */
export async function latestSectorFrame(sector: Sector, signal: AbortSignal, now = Date.now()): Promise<string> {
  if (sector.id === 'goes-west') return latestFrame(GOES_WEST, signal, now);
  if (sector.id === 'goes-east') return latestFrame(GOES_EAST, signal, now);
  if (sector.id === 'himawari') return latestFrame(HIMAWARI_IR, signal, now);
  try {
    const res = await fetch(MTG_CAPABILITIES, { signal });
    const t = res.ok ? wmsLatestTime(await res.text()) : null;
    if (t) return t;
  } catch (e) {
    if (signal.aborted) throw e;
  }
  return tenMinutes(now - MTG_LAG_MS);
}

async function image(url: string, signal: AbortSignal): Promise<ImageBitmap | null> {
  const res = await fetch(url, { signal });
  // GIBS answers a missing frame with 404 and EUMETSAT with a 200 XML error; both draw as nothing.
  if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) return null;
  return createImageBitmap(await res.blob());
}

/** GIBS leaves holes: a tile can be missing from one frame and present in the next, so step back up to 20 minutes. */
async function frameImage(product: GibsProduct, time: string, z: number, x: number, y: number, signal: AbortSignal): Promise<ImageBitmap | null> {
  for (let back = 0; back <= 2; back++) {
    const t = back ? tenMinutes(Date.parse(time) - back * 600_000) : time;
    const bitmap = await image(xyz(tileUrl(product, t), z, x, y), signal);
    if (bitmap) return bitmap;
  }
  return null;
}

function pixels(bitmap: ImageBitmap | null): Uint8ClampedArray {
  const ctx = new OffscreenCanvas(TILE, TILE).getContext('2d')!;
  if (bitmap) ctx.drawImage(bitmap, 0, 0, TILE, TILE);
  return ctx.getImageData(0, 0, TILE, TILE).data;
}

/** The sine of the sun's elevation at each pixel. */
function sunHeights(z: number, x: number, y: number, time: number): Float32Array {
  const sun = sunElevation(time);
  const n = TILE * 2 ** z;
  const out = new Float32Array(TILE * TILE);
  for (let row = 0; row < TILE; row++) {
    const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y * TILE + row + 0.5)) / n)));
    for (let col = 0; col < TILE; col++) {
      const lng = ((x * TILE + col + 0.5) / n) * 2 * Math.PI - Math.PI;
      out[row * TILE + col] = sun(lat, lng);
    }
  }
  return out;
}

async function draw(ctx: OffscreenCanvasRenderingContext2D, id: SatId, time: string, z: number, x: number, y: number, signal: AbortSignal) {
  if (id === 'goes-west' || id === 'goes-east') {
    const bitmap = await frameImage(id === 'goes-west' ? GOES_WEST : GOES_EAST, time, z, x, y, signal);
    if (bitmap) ctx.drawImage(bitmap, 0, 0);
    return;
  }
  if (id === 'mtg') {
    const bbox = tileBbox(z, x, y).join(',');
    const bitmap = await image(`${MTG_WMS}?service=WMS&version=1.3.0&request=GetMap&layers=rgb_geocolour&styles=&format=image/png&transparent=true&crs=EPSG:3857&width=${TILE}&height=${TILE}&bbox=${bbox}&time=${time}`, signal);
    if (bitmap) ctx.drawImage(bitmap, 0, 0);
    return;
  }
  const [ir, vis, day, night] = await Promise.all([
    frameImage(HIMAWARI_IR, time, z, x, y, signal),
    frameImage(HIMAWARI_VIS, time, z, x, y, signal),
    image(xyz(staticTileUrl(BLUE_MARBLE), z, x, y), signal),
    image(xyz(tileUrl(BLACK_MARBLE, BLACK_MARBLE_DATE), z, x, y), signal),
  ]);
  // No frame for this time: leave the band empty rather than show a cloudless Earth.
  if (!ir) return;
  const data = composeGeoColor(pixels(ir), pixels(vis), pixels(day), pixels(night), sunHeights(z, x, y, Date.parse(time)));
  ctx.putImageData(new ImageData(new Uint8ClampedArray(data), TILE, TILE), 0, 0);
}

let installed = false;

export function installGeosatProtocol(addProtocol: (name: string, action: AddProtocolAction) => void): void {
  if (installed) return;
  addProtocol(PROTOCOL, async (params, abort) => {
    const m = /^geosat:\/\/([a-z-]+)\/([^/]+)\/(\d+)\/(\d+)\/(\d+)$/.exec(params.url);
    const sector = m ? SECTORS.find(s => s.id === m[1]) : undefined;
    const canvas = new OffscreenCanvas(TILE, TILE);
    if (m && sector) {
      const [z, x, y] = [m[3], m[4], m[5]].map(Number);
      const cols = sectorColumns(z, x, sector.from, sector.to);
      if (cols) {
        const ctx = canvas.getContext('2d')!;
        await draw(ctx, sector.id, m[2], z, x, y, abort.signal);
        if (cols[0] > 0) ctx.clearRect(0, 0, cols[0], TILE);
        if (cols[1] < TILE) ctx.clearRect(cols[1], 0, TILE - cols[1], TILE);
      }
    }
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return { data: await blob.arrayBuffer() };
  });
  installed = true;
}
