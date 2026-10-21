/*
 * Lightning from two networks that meet at the prime meridian, both keyless with CORS *:
 * - NOAA nowCOAST: strike density, strikes per km² per minute over 15 minutes, on an 8 km grid, from the NLDN and
 *   GLD360 ground networks. It covers 25°S to 80°N from 110°E east across the Pacific and the Americas to 0°.
 *   NOAA's derived (Level 5) product, cleared for public distribution.
 * - EUMETSAT's Lightning Imager on Meteosat-12 (MTG-I1): Accumulated Flash Area, the flashes seen from orbit in each
 *   5 minutes on the imager's 2 km grid, from EUMETView's WMS. Drawn from 0° to 70°E (Europe, Africa, the Middle East)
 *   and south of NOAA's 25°S in South America. Credit "© EUMETSAT"; its licence for LI data is still to check
 *   (https://www.eumetsat.int/eumetsat-data-licensing), as for the Meteosat imagery.
 * Nothing covers 70°E to 110°E (India, Central Asia, western China, mainland Southeast Asia), Australia and New
 * Zealand south of 25°S, or the far north.
 */

export type LightningSourceId = 'nowcoast' | 'mtg';

export interface LightningSource {
  id: LightningSourceId;
  ows: string;
  layer: string;
  capabilities: string;
  attribution: string;
  /** How long one frame counts. */
  spanMs: number;
  /** Where the map draws it, boxes of [w, s, e, n]; the two never overlap, as their colours differ. */
  bounds?: [number, number, number, number][];
  covers(at: [number, number]): boolean;
}

const NOWCOAST_OWS = 'https://nowcoast.noaa.gov/geoserver/observations/lightning_detection/ows';
const MTG_OWS = 'https://view.eumetsat.int/geoserver/mtg_fd/wms';

/** The sub-satellite point is 0° N 0° E; past this the imager looks too obliquely to count on. */
const MTG_REACH_DEG = 75;

function degreesFromOrigin([lng, lat]: [number, number]): number {
  const r = Math.PI / 180;
  return Math.acos(Math.cos(lat * r) * Math.cos(lng * r)) / r;
}

export const LIGHTNING_SOURCES: readonly LightningSource[] = [
  {
    id: 'nowcoast',
    ows: NOWCOAST_OWS,
    layer: 'ldn_lightning_strike_density',
    capabilities: `${NOWCOAST_OWS}?service=WMS&version=1.3.0&request=GetCapabilities`,
    attribution: '<a href="https://nowcoast.noaa.gov/" target="_blank" rel="noopener">Lightning: NOAA nowCOAST</a> (NLDN, GLD360)',
    spanMs: 15 * 60_000,
    covers: ([lng, lat]) => lat >= -25 && lat <= 80 && (lng >= 110 || lng <= 0),
  },
  {
    id: 'mtg',
    ows: MTG_OWS,
    layer: 'li_afa',
    // The layer's own capabilities: a few KB, where the workspace's run to hundreds.
    capabilities: 'https://view.eumetsat.int/geoserver/mtg_fd/li_afa/ows?service=WMS&version=1.3.0&request=GetCapabilities',
    attribution: '<a href="https://view.eumetsat.int/" target="_blank" rel="noopener">Lightning © EUMETSAT</a> (Meteosat Lightning Imager)',
    spanMs: 5 * 60_000,
    bounds: [[0, -70, 70, 70], [-70, -70, 0, -25]],
    covers: ([lng, lat]) => (lng > 0 ? lng <= 70 : lng >= -70 && lat < -25) && Math.abs(lat) <= 70 && degreesFromOrigin([lng, lat]) <= MTG_REACH_DEG,
  },
];

/** Whether either network reaches the place. */
export const lightningCovers = (at: [number, number]) => LIGHTNING_SOURCES.some(s => s.covers(at));

/** 8 km and 2 km cells; deeper tiles would only enlarge them. */
export const LIGHTNING_MAX_ZOOM = 8;
/** How far back the frames go, as Replay can reach. */
const HISTORY_MS = 6 * 3_600_000;

/**
 * The frame times on offer, oldest first, from the layer's time dimension: nowCOAST lists them, EUMETView gives a
 * period (`start/end/PT5M`) reaching back to 2025, of which the last six hours are kept.
 */
export function parseLightningTimes(xml: string, layer: string): number[] {
  const at = xml.indexOf(`<Name>${layer}</Name>`);
  const dim = /<Dimension[^>]*name="time"[^>]*>([^<]+)<\/Dimension>/.exec(at < 0 ? xml : xml.slice(at));
  if (!dim) return [];
  const period = /^\s*([^/]+)\/([^/]+)\/PT(\d+)M\s*$/.exec(dim[1]);
  if (period) {
    const [start, end, step] = [Date.parse(period[1]), Date.parse(period[2]), Number(period[3]) * 60_000];
    if (!Number.isFinite(start) || !Number.isFinite(end) || !(step > 0)) return [];
    const times: number[] = [];
    for (let t = end; t >= Math.max(start, end - HISTORY_MS); t -= step) times.unshift(t);
    return times;
  }
  return dim[1].split(',').map(s => Date.parse(s.trim())).filter(Number.isFinite).sort((a, b) => a - b);
}

export async function lightningTimes(source: LightningSource, signal?: AbortSignal): Promise<number[]> {
  const res = await fetch(source.capabilities, { signal, cache: 'no-store' });
  return res.ok ? parseLightningTimes(await res.text(), source.layer) : [];
}

function getMap(source: LightningSource, time: number, crs: string, width: number, height: number): string {
  const q = new URLSearchParams({
    service: 'WMS', version: '1.3.0', request: 'GetMap', layers: source.layer, styles: '', crs,
    width: String(width), height: String(height), format: 'image/png', transparent: 'true', time: new Date(time).toISOString(),
  });
  return `${source.ows}?${q}`;
}

/** A WMS tile template for one frame; MapLibre fills in each tile's box. */
export const lightningTiles = (source: LightningSource, time: number) => `${getMap(source, time, 'EPSG:3857', 256, 256)}&bbox={bbox-epsg-3857}`;

/** One frame over a [w, s, e, n] box in degrees, for reading its pixels. */
export const lightningImage = (source: LightningSource, time: number, box: [number, number, number, number], width: number, height: number) =>
  `${getMap(source, time, 'CRS:84', width, height)}&bbox=${box.join(',')}`;

/** The newest frame at or before `t`, if it is recent enough to stand for it; null outside the frames on offer. */
export function lightningFrameAt(times: number[], t: number, spanMs: number): number | null {
  for (let i = times.length - 1; i >= 0; i--) {
    if (times[i] <= t) return t - times[i] <= spanMs ? times[i] : null;
  }
  return null;
}
