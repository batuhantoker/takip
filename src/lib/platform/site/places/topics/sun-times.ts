/**
 * Sunrise, sunset and twilight for a place and day, from NOAA's solar calculator equations (after Meeus,
 * Astronomical Algorithms): good to about a minute between 1800 and 2100 at latitudes within ±72°, and to a few
 * minutes beyond. Times are epoch ms; the caller turns them into the place's own clock.
 */

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const MIN_MS = 60_000;

/** The Sun's elevation at each event, degrees. Sunrise and sunset allow for refraction and the Sun's radius. */
export const SUN_ELEVATION = { horizon: -0.833, civil: -6, nautical: -12, astronomical: -18, golden: 6 } as const;

/** When the Sun crosses an elevation that day, or which side of it the Sun stays on all day. */
export type Crossing = number | 'above' | 'below';

export interface SunDay {
  noon: number;
  /** Above the horizon at solar noon, degrees, without refraction; negative in polar night. */
  noonElevation: number;
  rise: Crossing;
  set: Crossing;
  /** Morning and evening crossings of each twilight's depth: dawn begins, dusk ends. */
  civil: [Crossing, Crossing];
  nautical: [Crossing, Crossing];
  astronomical: [Crossing, Crossing];
  /** The Sun at 6°: the morning golden hour ends, the evening one begins. */
  golden: [Crossing, Crossing];
}

/** The Sun's declination (degrees) and the equation of time (minutes) at a moment. */
export function solarPosition(ms: number): { dec: number; eot: number } {
  const T = (ms / DAY_MS + 2440587.5 - 2451545) / 36525;
  const L0 = 280.46646 + T * (36000.76983 + T * 0.0003032);
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T))
    + Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * RAD) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
  const dec = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD)) / RAD;
  const y = Math.tan((eps / 2) * RAD) ** 2;
  const eot = (4 / RAD) * (y * Math.sin(2 * L0 * RAD) - 2 * e * Math.sin(M * RAD) + 4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD)
    - 0.5 * y * y * Math.sin(4 * L0 * RAD) - 1.25 * e * e * Math.sin(2 * M * RAD));
  return { dec, eot };
}

/** The hour angle at which the Sun stands at `h` degrees, or which side of `h` it stays on all day. */
function hourAngle(lat: number, dec: number, h: number): number | 'above' | 'below' {
  const c = (Math.sin(h * RAD) - Math.sin(lat * RAD) * Math.sin(dec * RAD)) / (Math.cos(lat * RAD) * Math.cos(dec * RAD));
  if (c > 1) return 'below';
  if (c < -1) return 'above';
  return Math.acos(c) / RAD;
}

/** Solar noon nearest `near`, the UTC moment of 12:00 on the place's clock that day, and that day's UTC midnight. */
function solarNoon(lon: number, near: number): { noon: number; base: number } {
  let base = Math.floor(near / DAY_MS) * DAY_MS;
  // Kiribati and Samoa keep clocks a day away from their longitude, so pick the solar noon on their calendar day.
  base += Math.round((near - (base + (720 - 4 * lon) * MIN_MS)) / DAY_MS) * DAY_MS;
  let noon = base + (720 - 4 * lon) * MIN_MS;
  for (let i = 0; i < 2; i++) noon = base + (720 - 4 * lon - solarPosition(noon).eot) * MIN_MS;
  return { noon, base };
}

/** Iterated at the moment itself, as NOAA's calculator does, so the Sun's motion during the day is allowed for. */
function crossing(lat: number, lon: number, { noon, base }: { noon: number; base: number }, h: number, side: 1 | -1): Crossing {
  let t = noon;
  for (let i = 0; i < 3; i++) {
    const { dec, eot } = solarPosition(t);
    const ha = hourAngle(lat, dec, h);
    if (typeof ha !== 'number') return ha;
    t = base + (720 - 4 * (lon + side * ha) - eot) * MIN_MS;
  }
  return t;
}

/** The day around the solar noon nearest `localNoon`, the UTC moment of 12:00 on the place's own clock. */
export function sunDay(lat: number, lon: number, localNoon: number): SunDay {
  const day = solarNoon(lon, localNoon);
  const { noon } = day;
  const pair = (h: number): [Crossing, Crossing] => [crossing(lat, lon, day, h, 1), crossing(lat, lon, day, h, -1)];
  const [rise, set] = pair(SUN_ELEVATION.horizon);
  return {
    noon,
    noonElevation: 90 - Math.abs(lat - solarPosition(noon).dec),
    rise,
    set,
    civil: pair(SUN_ELEVATION.civil),
    nautical: pair(SUN_ELEVATION.nautical),
    astronomical: pair(SUN_ELEVATION.astronomical),
    golden: pair(SUN_ELEVATION.golden),
  };
}

/**
 * When a shadow is `factor` times as long as what casts it, beyond its noon shadow: where Asr begins, at 1 in the
 * Shafi‘i, Maliki and Hanbali schools and 2 in the Hanafi. Null where the Sun never climbs that high.
 */
export function shadowTime(lat: number, lon: number, localNoon: number, factor: number): number | null {
  const day = solarNoon(lon, localNoon);
  const h = Math.atan(1 / (factor + Math.tan(Math.abs(lat - solarPosition(day.noon).dec) * RAD))) / RAD;
  const t = crossing(lat, lon, day, h, -1);
  return typeof t === 'number' ? t : null;
}

/** Sunrise and sunset alone, for scanning a year. */
export function riseSet(lat: number, lon: number, localNoon: number): Pick<SunDay, 'rise' | 'set'> {
  const day = solarNoon(lon, localNoon);
  return { rise: crossing(lat, lon, day, SUN_ELEVATION.horizon, 1), set: crossing(lat, lon, day, SUN_ELEVATION.horizon, -1) };
}

/** From sunrise to sunset; a whole day under the midnight sun, none in polar night. */
export function dayLength(d: Pick<SunDay, 'rise' | 'set'>): number {
  if (typeof d.rise === 'number' && typeof d.set === 'number') return d.set - d.rise;
  return d.rise === 'above' ? DAY_MS : 0;
}

/** Day length on a day without the place's clock: solar noon by longitude alone, for the solstices in copy. */
export const dayLengthOn = (lat: number, lon: number, utcDate: string) =>
  dayLength(riseSet(lat, lon, Date.parse(`${utcDate}T12:00:00Z`) - lon * 4 * MIN_MS));
