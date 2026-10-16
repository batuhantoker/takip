/*
 * Lightning strike density from NOAA nowCOAST: strikes per km² per minute over 15 minutes, on an 8 km
 * grid, from the NLDN and GLD360 networks. It covers 25°S to 80°N from 110°E east across the Pacific and
 * the Americas to 0°. NOAA's derived (Level 5) product, cleared for public distribution. Keyless, CORS *.
 */

const OWS = 'https://nowcoast.noaa.gov/geoserver/observations/lightning_detection/ows';
const LAYER = 'ldn_lightning_strike_density';
export const LIGHTNING_CAPABILITIES = `${OWS}?service=WMS&version=1.3.0&request=GetCapabilities`;
export const LIGHTNING_ATTRIBUTION = '<a href="https://nowcoast.noaa.gov/" target="_blank" rel="noopener">Lightning: NOAA nowCOAST</a> (NLDN, GLD360)';
/** 8 km cells; deeper tiles would only enlarge them. */
export const LIGHTNING_MAX_ZOOM = 8;
/** Each frame counts the 15 minutes up to its time. */
const FRAME_SPAN_MS = 15 * 60_000;

/** The frame times on offer, oldest first, from the layer's time dimension (about the last six hours). */
export function parseLightningTimes(xml: string): number[] {
  const at = xml.indexOf(`<Name>${LAYER}</Name>`);
  const dim = /<Dimension[^>]*name="time"[^>]*>([^<]+)<\/Dimension>/.exec(at < 0 ? xml : xml.slice(at));
  if (!dim) return [];
  return dim[1].split(',').map(s => Date.parse(s.trim())).filter(Number.isFinite).sort((a, b) => a - b);
}

export async function lightningTimes(signal?: AbortSignal): Promise<number[]> {
  const res = await fetch(LIGHTNING_CAPABILITIES, { signal, cache: 'no-store' });
  return res.ok ? parseLightningTimes(await res.text()) : [];
}

/** A WMS tile template for one frame; MapLibre fills in each tile's box. */
export function lightningTiles(time: number): string {
  const q = new URLSearchParams({
    service: 'WMS', version: '1.3.0', request: 'GetMap', layers: LAYER, styles: '', crs: 'EPSG:3857',
    width: '256', height: '256', format: 'image/png', transparent: 'true', time: new Date(time).toISOString(),
  });
  return `${OWS}?${q}&bbox={bbox-epsg-3857}`;
}

/** The newest frame at or before `t`, if it is recent enough to stand for it; null outside the frames on offer. */
export function lightningFrameAt(times: number[], t: number): number | null {
  for (let i = times.length - 1; i >= 0; i--) {
    if (times[i] <= t) return t - times[i] <= FRAME_SPAN_MS ? times[i] : null;
  }
  return null;
}
