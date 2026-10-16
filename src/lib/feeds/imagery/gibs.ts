/*
 * NASA GIBS imagery: a true-colour picture of the whole Earth for any day since 2000-02-24, and the
 * GOES geostationary disks every 10 minutes. Keyless WMTS in EPSG:3857 with CORS *; survey and layer
 * catalogue in docs/inspiration-sources/nasa-worldview.md.
 * Terms: NASA mission data is CC0; GIBS asks to be acknowledged, and NASA must not appear to endorse us.
 */

const WMTS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';
export const GIBS_ATTRIBUTION = 'Imagery: NASA EOSDIS GIBS';

const DAY_MS = 86_400_000;
const TEN_MIN_MS = 600_000;

export interface GibsProduct {
  id: string;
  /** The GoogleMapsCompatible level: the deepest zoom it serves, and one past it returns 400. */
  level: number;
  ext: 'jpg' | 'jpeg' | 'png';
}

export const MODIS_TERRA: GibsProduct = { id: 'MODIS_Terra_CorrectedReflectance_TrueColor', level: 9, ext: 'jpg' };
export const VIIRS_NOAA20: GibsProduct = { id: 'VIIRS_NOAA20_CorrectedReflectance_TrueColor', level: 9, ext: 'jpg' };
export const GOES_EAST: GibsProduct = { id: 'GOES-East_ABI_GeoColor', level: 7, ext: 'png' };
export const GOES_WEST: GibsProduct = { id: 'GOES-West_ABI_GeoColor', level: 7, ext: 'png' };
/** Clean infrared, colour-enhanced for the coldest tops; GIBS has no Himawari GeoColor. */
export const HIMAWARI_IR: GibsProduct = { id: 'Himawari_AHI_Band13_Clean_Infrared', level: 6, ext: 'png' };
/** Red visible reflectance, daytime only and not corrected for the sun's angle. */
export const HIMAWARI_VIS: GibsProduct = { id: 'Himawari_AHI_Band3_Red_Visible_1km', level: 7, ext: 'png' };
/** Cloud-free ground by day and city lights by night, for the Himawari band (lib/feeds/imagery/geostationary). */
export const BLUE_MARBLE: GibsProduct = { id: 'BlueMarble_NextGeneration', level: 8, ext: 'jpeg' };
export const BLACK_MARBLE: GibsProduct = { id: 'VIIRS_Black_Marble', level: 8, ext: 'png' };
export const BLACK_MARBLE_DATE = '2016-01-01';

/** Both daily products serve Level 9. */
export const DAILY_MAX_ZOOM = 9;

/** MODIS Terra's first day; there is no daily picture before it. */
export const DAILY_FIRST = '2000-02-24';
/** From here NOAA-20's VIIRS, whose wider swath leaves no gaps between passes at the equator. */
const VIIRS_FIRST = '2018-01-05';

/** GIBS's newest frames trail real time by 30 to 40 minutes; this is the guess when it can't be asked. */
const GEO_LAG_MS = 50 * 60_000;

export const utcDay = (ms: number) => new Date(Math.floor(ms / DAY_MS) * DAY_MS).toISOString().slice(0, 10);
export const tenMinutes = (ms: number) => new Date(Math.floor(ms / TEN_MIN_MS) * TEN_MIN_MS).toISOString().replace('.000Z', 'Z');

/**
 * The day to draw: the timeline's, or yesterday when live, because today's swaths are still coming in
 * (GIBS's own default date can be tomorrow's near-empty picture). Null before the imagery begins.
 */
export function dailyDay(t: number | null, now = Date.now()): string | null {
  const day = utcDay(t ?? now - DAY_MS);
  return day < DAILY_FIRST ? null : day;
}

export const dailyProduct = (day: string) => (day < VIIRS_FIRST ? MODIS_TERRA : VIIRS_NOAA20);

export const tileUrl = (p: GibsProduct, time: string) =>
  `${WMTS}/${p.id}/default/${time}/GoogleMapsCompatible_Level${p.level}/{z}/{y}/{x}.${p.ext}`;

/** A layer without a time dimension. */
export const staticTileUrl = (p: GibsProduct) => `${WMTS}/${p.id}/default/GoogleMapsCompatible_Level${p.level}/{z}/{y}/{x}.${p.ext}`;

/** The times GIBS holds for a product between two instants (DescribeDomains). */
export const domainsUrl = (p: GibsProduct, from: number, to: number) =>
  `${WMTS}/1.0.0/${p.id}/default/GoogleMapsCompatible_Level${p.level}/all/${tenMinutes(from)}--${tenMinutes(to)}.xml`;

/** The newest instant in a DescribeDomains reply, whose `<Domain>` lists `start/end/PT10M` runs and single instants. */
export function domainEnd(xml: string): string | null {
  const domain = /<Domain>([^<]*)<\/Domain>/.exec(xml)?.[1];
  if (!domain) return null;
  const ends = domain.split(',').map(run => {
    const parts = run.trim().split('/');
    return parts.length >= 2 ? parts[1] : parts[0];
  }).filter(t => /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(t));
  return ends.length ? ends.reduce((a, b) => (a > b ? a : b)) : null;
}

/**
 * The newest complete geostationary frame, asked of GIBS over the last three hours; a guess if that fails.
 * GIBS lists a frame while its tiles are still being published, so the one before it is taken.
 */
export async function latestFrame(p: GibsProduct, signal: AbortSignal, now = Date.now()): Promise<string> {
  try {
    const res = await fetch(domainsUrl(p, now - 3 * 3_600_000, now), { signal });
    if (res.ok) {
      const end = domainEnd(await res.text());
      if (end) return tenMinutes(Date.parse(end) - TEN_MIN_MS);
    }
  } catch (e) {
    if (signal.aborted) throw e;
  }
  return tenMinutes(now - GEO_LAG_MS);
}

/** A replayed instant as a frame time, never newer than GIBS can have. */
export const replayFrame = (t: number, now = Date.now()) => tenMinutes(Math.min(t, now - GEO_LAG_MS));
