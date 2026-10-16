import { EARTH_RADIUS, HALF, PAD, PADDED, TILE } from './tiles';

/* ── Sunlight ─────────────────────────────────────────────────────────────── */

/**
 * The cosine of the sun's zenith angle anywhere on Earth at `time`: above zero
 * by day. The same approximation the map draws its night shade with, so the
 * visible band fades out exactly where the shade begins.
 */
export function sunElevation(time: number): (latRad: number, lngRad: number) => number {
  const { sinDec, cosDec, subsolar } = sunTerms(time);
  return (lat, lng) => Math.sin(lat) * sinDec + Math.cos(lat) * cosDec * Math.cos(lng - subsolar);
}

/** The sun's declination, as sine and cosine, and the longitude it is overhead at, in radians. */
export function sunTerms(time: number) {
  const now = new Date(time);
  const dayOfYear = Math.floor((time - Date.UTC(now.getUTCFullYear(), 0, 0)) / 86400000);
  const dec = (-23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10)) * Math.PI) / 180;
  const subsolar = ((12 - (now.getUTCHours() + now.getUTCMinutes() / 60)) * 15 * Math.PI) / 180;
  return { sinDec: Math.sin(dec), cosDec: Math.cos(dec), subsolar };
}

/** Latitude and longitude, in radians, of each row and column of a padded tile. */
export function tileGrid(z: number, x: number, y: number) {
  const size = (2 * HALF) / 2 ** z;
  const px = size / TILE;
  const lat = new Float64Array(PADDED), lng = new Float64Array(PADDED);
  for (let n = 0; n < PADDED; n++) {
    const my = HALF - y * size - (n - PAD + 0.5) * px;
    lat[n] = 2 * Math.atan(Math.exp(my / EARTH_RADIUS)) - Math.PI / 2;
    lng[n] = (-HALF + x * size + (n - PAD + 0.5) * px) / EARTH_RADIUS;
  }
  return { lat, lng };
}

/** Sun elevations, as cosines, over which the visible band fades in after dawn. */
export const DAWN = 0.03;
export const DAY = 0.2;

/** How much of a tile is in daylight, 0 to 1, from a 5 × 5 sample — enough to skip the visible band at night. */
export function tileDaylight(z: number, x: number, y: number, time: number): number {
  const { lat, lng } = tileGrid(z, x, y);
  const sun = sunElevation(time);
  let lit = 0;
  for (let a = 0; a < 5; a++) {
    for (let b = 0; b < 5; b++) {
      const j = PAD + Math.round((a * (TILE - 1)) / 4), i = PAD + Math.round((b * (TILE - 1)) / 4);
      if (sun(lat[j], lng[i]) > DAWN) lit++;
    }
  }
  return lit / 25;
}
