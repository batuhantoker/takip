/**
 * TAKIP — Live Clouds: NOAA's global satellite mosaic, drawn as lit cloud.
 *
 * The source is GMGSI, the Global Mosaic of Geostationary Satellite Imagery:
 * every weather satellite in geostationary orbit stitched into one picture of
 * the world, refreshed hourly and served by NOAA nowCOAST as a WMS. Two of its
 * bands are used. Thermal infrared shows cloud day and night, and how cold a
 * cloud top is says how high it reaches. Visible light shows the cloud itself,
 * texture and sunlit relief, but only on the day side.
 *
 * Everything here is pure: the worker (tile.worker.ts) fetches and
 * decodes, the modules beside this one turn grey satellite pixels into cloud,
 * and the map layer (layer.ts) hangs that cloud at altitude over the ground.
 */

export const CLOUDS_LAYER = 'live-clouds';
/** An empty source whose only job is to put NOAA's credit on the map while the clouds are up. */
export const CLOUDS_CREDIT = 'live-clouds-credit';
export const CLOUDS_ATTRIBUTION = 'Clouds © NOAA/NESDIS GMGSI';
/** The imagery is about 3 km a pixel, which zoom 6 already shows in full. */
export const CLOUDS_MAX_ZOOM = 6;

export type Band = 'ir' | 'vis';
const LAYERS: Record<Band, string> = {
  ir: 'global_longwave_imagery_mosaic',
  vis: 'global_visible_imagery_mosaic',
};
const WMS = 'https://nowcoast.noaa.gov/geoserver/satellite/wms';

export const TILE = 256;
/**
 * Pixels fetched beyond each edge of a tile. Relief and shadows read their
 * neighbours, so without this every tile seam would show as a lit edge.
 */
export const PAD = 8;
export const PADDED = TILE + 2 * PAD;

/** Half the width of the Web Mercator world, in metres. */
export const HALF = 20037508.342789244;
export const EARTH_RADIUS = 6378137;

/** The world reference image. The mosaic stops near 72.7° north and south; it covers that band. */
export const REF_WIDTH = 2048;
export const REF_HEIGHT = 1230;
export const REF_HALF_HEIGHT = (HALF * REF_HEIGHT) / REF_WIDTH;

/** How long after the hour NOAA has that hour's frame up; it was 13 minutes when checked. */
const PUBLISH_DELAY_MS = 20 * 60_000;

export interface Tile { z: number; x: number; y: number; time: string }

/** A tile's Web Mercator bounds, grown by `pad` pixels a side: minx, miny, maxx, maxy. */
export function tileBbox(z: number, x: number, y: number, pad = 0): [number, number, number, number] {
  const size = (2 * HALF) / 2 ** z;
  const px = (size / TILE) * pad;
  const minx = -HALF + x * size;
  const maxy = HALF - y * size;
  return [minx - px, maxy - size - px, minx + size + px, maxy + px];
}

/**
 * The newest hourly frame NOAA should have published by `now`, as a WMS TIME.
 * The server snaps to the nearest frame it holds, but asking for an hour before
 * it exists would cache last hour's picture under this hour's name.
 */
export function frameTime(now: number = Date.now()): string {
  const t = new Date(now - PUBLISH_DELAY_MS);
  t.setUTCMinutes(0, 0, 0);
  return t.toISOString().replace('.000Z', 'Z');
}

/** Whether a tile is one NOAA can be asked for: a real tile, at a zoom the imagery has, of an hourly frame. */
export function isCloudTile({ z, x, y, time }: Tile): boolean {
  return Number.isInteger(z) && Number.isInteger(x) && Number.isInteger(y)
    && z >= 0 && z <= CLOUDS_MAX_ZOOM && x >= 0 && y >= 0 && x < 2 ** z && y < 2 ** z
    && /^\d{4}-\d\d-\d\dT\d\d:00:00Z$/.test(time);
}

function getMap(band: Band, bbox: number[], width: number, height: number, time: string, format: string): string {
  const params = new URLSearchParams({
    SERVICE: 'WMS', REQUEST: 'GetMap', VERSION: '1.3.0',
    LAYERS: LAYERS[band], STYLES: '', FORMAT: format, TRANSPARENT: 'true', BGCOLOR: '0x000000',
    CRS: 'EPSG:3857', BBOX: bbox.join(','),
    WIDTH: String(width), HEIGHT: String(height), TIME: time,
  });
  return `${WMS}?${params.toString()}`;
}

/** One tile of one band, with its padding. */
export function tileUrl(band: Band, { z, x, y, time }: Tile): string {
  return getMap(band, tileBbox(z, x, y, PAD), PADDED, PADDED, time, 'image/png');
}

/** The whole world in one band, once a frame — the scale every tile is matched to. */
export function referenceUrl(band: Band, time: string): string {
  return getMap(band, [-HALF, -REF_HALF_HEIGHT, HALF, REF_HALF_HEIGHT], REF_WIDTH, REF_HEIGHT, time, 'image/jpeg');
}
