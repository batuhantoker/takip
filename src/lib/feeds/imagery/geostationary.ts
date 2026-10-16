/*
 * The whole Earth live from the geostationary ring. Each band of longitude comes from the satellite
 * nearest above it, cut at the midpoints between their sub-satellite longitudes, so no two overlap.
 * GOES and MTG publish GeoColor. Himawari has no public colour product in a web projection (CIRA's
 * SLIDER has one, in satellite projection, without CORS), so its band is drawn here: Himawari's
 * infrared clouds over NASA Blue Marble by day and Black Marble city lights by night, as GeoColor does.
 */

export type SatId = 'goes-west' | 'goes-east' | 'mtg' | 'himawari';

export interface Sector {
  id: SatId;
  /** West and east edges, degrees. */
  from: number;
  to: number;
  maxzoom: number;
  attribution: string;
}

export const SECTORS: Sector[] = [
  // GOES-18 at 137.2°W
  { id: 'goes-west', from: -180, to: -106.2, maxzoom: 7, attribution: 'GOES-West: NOAA via NASA GIBS' },
  // GOES-19 at 75.2°W
  { id: 'goes-east', from: -106.2, to: -37.6, maxzoom: 7, attribution: 'GOES-East: NOAA via NASA GIBS' },
  // Meteosat-12 (MTG-I1) at 0°. Terms: the EUMETSAT data policy; check commercial use before paid plans.
  { id: 'mtg', from: -37.6, to: 70.35, maxzoom: 7, attribution: 'Meteosat: © EUMETSAT' },
  // Himawari-9 at 140.7°E
  { id: 'himawari', from: 70.35, to: 180, maxzoom: 6, attribution: 'Himawari-9: JMA via NASA GIBS; Blue Marble and Black Marble: NASA' },
];

const TILE = 256;

/** The pixel columns [start, end) of tile (z, x) whose centres lie in [from, to); null if none do. */
export function sectorColumns(z: number, x: number, from: number, to: number): [number, number] | null {
  const n = TILE * 2 ** z;
  const px = (lon: number) => Math.min(TILE, Math.max(0, Math.round(((lon + 180) / 360) * n - x * TILE)));
  const start = px(from);
  const end = px(to);
  return end > start ? [start, end] : null;
}

/**
 * Enhanced infrared to cloud cover: the coloured shades are the coldest tops; greys whiten as cloud tops rise.
 * Fitted to GOES-East at night (2026-10-15), where GeoColor draws grey up to 125 as clear and brightens
 * cloud about linearly from there to the coloured tops.
 */
export function cloudiness(r: number, g: number, b: number): number {
  if (Math.max(r, g, b) - Math.min(r, g, b) >= 12) return 1;
  return Math.min(1, Math.max(0, (r - 125) / 70));
}

const DAY_CLOUD = [242, 244, 247];
// A cool grey between GOES's night cloud (the fit) and Meteosat's dimmer one, its two neighbours.
const NIGHT_CLOUD = [146, 156, 176];

/**
 * Cloud from visible light: how much brighter than the cloud-free ground a pixel is, once the
 * sun's angle is divided out (`sunSin`, the sine of its elevation). Infrared misses low, warm cloud.
 */
export function visibleCloudiness(vis: number, ground: number, sunSin: number): number {
  if (sunSin <= 0) return 0;
  const excess = vis / 255 / Math.max(0.12, sunSin) - ground / 255;
  return Math.min(1, Math.max(0, (excess - 0.08) / 0.35));
}

/**
 * Himawari's band as GeoColor draws it: ground from `day` and `night` mixed by daylight, then cloud
 * from the infrared, or from the visible band where that sees more by day. `sunSin` holds the sine
 * of the sun's elevation per pixel; the rest are RGBA of the same size, `vis` all zero at night.
 */
export function composeGeoColor(ir: Uint8ClampedArray, vis: Uint8ClampedArray, day: Uint8ClampedArray, night: Uint8ClampedArray, sunSin: Float32Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(ir.length);
  for (let p = 0, i = 0; i < ir.length; p++, i += 4) {
    const d = daylightWeight(sunSin[p]);
    const ground = 0.3 * day[i] + 0.59 * day[i + 1] + 0.11 * day[i + 2];
    const lit = vis[i + 3] ? d * visibleCloudiness(vis[i], ground, sunSin[p]) : 0;
    const c = Math.max(ir[i + 3] ? cloudiness(ir[i], ir[i + 1], ir[i + 2]) : 0, lit);
    for (let k = 0; k < 3; k++) {
      const base = night[i + k] * (1 - d) + day[i + k] * d;
      const cloud = NIGHT_CLOUD[k] * (1 - d) + DAY_CLOUD[k] * d;
      out[i + k] = base * (1 - c) + cloud * c;
    }
    out[i + 3] = 255;
  }
  return out;
}

/** Sine of the sun's elevation to daylight weight: dark below −6° (civil dusk), full above +6°. */
export function daylightWeight(sinElevation: number): number {
  const t = Math.min(1, Math.max(0, (sinElevation + 0.1045) / 0.209));
  return t * t * (3 - 2 * t);
}

/** The newest frame in a WMS layer's capabilities: its time dimension's default, or the end of its range. */
export function wmsLatestTime(xml: string): string | null {
  const dim = /<Dimension[^>]*name="time"[^>]*>([^<]*)</.exec(xml);
  if (!dim) return null;
  const fallback = dim[1].split(',').pop()!.split('/')[1] ?? null;
  const t = /default="([^"]+)"/.exec(dim[0])?.[1] ?? fallback;
  if (!t || Number.isNaN(Date.parse(t))) return null;
  return new Date(Date.parse(t)).toISOString().replace('.000Z', 'Z');
}
