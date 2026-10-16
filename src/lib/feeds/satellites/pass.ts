import { ecfToLookAngles, eciToEcf, gstime, jday, propagate, shadowFraction, sunPos, type SatRec } from 'satellite.js';

/*
 * When a satellite next crosses the sky over a place: rise, highest point and set above a minimum
 * elevation, and whether it can be seen by eye. Scan, bisect and parabolic peak after God's Eye View
 * (src/data/satellitePass.js, MIT), itself after skylight's nextISSPass (MIT).
 */

const RAD = Math.PI / 180;

export interface SkyPass {
  /** Epoch ms it climbs past the minimum elevation; the search start when it is already up. */
  rise: number;
  /** Epoch ms of its highest point. */
  peak: number;
  /** Epoch ms it drops below the minimum elevation; null when still up at the end of the search. */
  set: number | null;
  /** Degrees above the horizon at the highest point. */
  maxElevation: number;
  /** Compass bearings, in degrees, where it rises and sets. */
  riseAzimuth: number;
  setAzimuth: number | null;
  /** Sunlit while the place is dark (sun at or below -6°) at some point of the pass. */
  visible: boolean;
}

export interface PassOptions {
  /** Degrees above the horizon that count as up. Low passes hide behind buildings and haze. */
  minElevation?: number;
  hours?: number;
  max?: number;
}

interface Look { elevation: number; azimuth: number; eci: { x: number; y: number; z: number } }

export function lookAngles(satrec: SatRec, t: number, lat: number, lng: number): Look | null {
  const when = new Date(t);
  let eci;
  try {
    eci = propagate(satrec, when)?.position;
  } catch {
    return null;
  }
  if (!eci || typeof eci === 'boolean' || ![eci.x, eci.y, eci.z].every(Number.isFinite)) return null;
  const look = ecfToLookAngles({ latitude: lat * RAD, longitude: lng * RAD, height: 0 }, eciToEcf(eci, gstime(when)));
  return { elevation: look.elevation / RAD, azimuth: ((look.azimuth / RAD) % 360 + 360) % 360, eci };
}

/** The sun's elevation in degrees at a place. Parallax is ignored; it is far below a degree. */
export function sunAltitude(t: number, lat: number, lng: number): number {
  const when = new Date(t);
  const { x, y, z } = eciToEcf(sunPos(jday(when)).rsun, gstime(when));
  const r = Math.hypot(x, y, z);
  const up = [Math.cos(lat * RAD) * Math.cos(lng * RAD), Math.cos(lat * RAD) * Math.sin(lng * RAD), Math.sin(lat * RAD)];
  return Math.asin((up[0] * x + up[1] * y + up[2] * z) / r) / RAD;
}

/** Seen by eye: the satellite catches the sun while the sky over the place is dark. */
function seen(look: Look, t: number, lat: number, lng: number): boolean {
  return sunAltitude(t, lat, lng) <= -6 && shadowFraction(sunPos(jday(new Date(t))).rsun, look.eci) < 0.5;
}

const COARSE_MS = 20_000;
const FINE_MS = 5_000;
const MAX_HOURS = 72;

/** The time, within (a, b], where the elevation crosses `min`; `rising` says which way. */
function crossing(satrec: SatRec, a: number, b: number, lat: number, lng: number, min: number, rising: boolean): number {
  for (let i = 0; i < 12; i++) {
    const mid = (a + b) / 2;
    const up = (lookAngles(satrec, mid, lat, lng)?.elevation ?? -90) >= min;
    if (up === rising) b = mid;
    else a = mid;
  }
  return Math.round(rising ? b : a);
}

export function nextSkyPasses(satrec: SatRec, lat: number, lng: number, from: number, opts: PassOptions = {}): SkyPass[] {
  const min = opts.minElevation ?? 10;
  const end = from + Math.min(opts.hours ?? 24, MAX_HOURS) * 3_600_000;
  const max = opts.max ?? 5;
  const passes: SkyPass[] = [];
  const elevation = (t: number) => lookAngles(satrec, t, lat, lng)?.elevation ?? -90;

  let t = from;
  let prev = elevation(t);
  while (t <= end && passes.length < max) {
    let rise: number;
    if (prev >= min && t === from) rise = from;
    else {
      let next = t + COARSE_MS, e = elevation(next);
      while (e < min && next <= end) {
        t = next;
        next += COARSE_MS;
        e = elevation(next);
      }
      if (e < min) break;
      rise = crossing(satrec, t, next, lat, lng, min, true);
    }

    let peak = rise, top = -90, left = NaN, right = NaN, last = NaN, set: number | null = null, visible = false;
    let s = rise;
    for (; s <= end; s += FINE_MS) {
      const look = lookAngles(satrec, s, lat, lng);
      const e = look?.elevation ?? -90;
      if (e < min && s > rise) {
        if (Number.isNaN(right) && s > peak) right = e;
        set = crossing(satrec, s - FINE_MS, s, lat, lng, min, false);
        break;
      }
      if (look && !visible && seen(look, s, lat, lng)) visible = true;
      if (e > top) {
        top = e;
        peak = s;
        left = last;
        right = NaN;
      } else if (Number.isNaN(right)) right = e;
      last = e;
    }

    // Fit a parabola through the samples either side of the highest one.
    const curve = left - 2 * top + right;
    if (Number.isFinite(curve) && curve < 0) {
      const shift = ((left - right) / (2 * curve)) * FINE_MS;
      if (Math.abs(shift) < FINE_MS) {
        peak = Math.round(peak + shift);
        top = Math.min(90, top - (left - right) ** 2 / (8 * curve));
      }
    }

    passes.push({
      rise,
      peak,
      set,
      maxElevation: top,
      riseAzimuth: lookAngles(satrec, rise, lat, lng)?.azimuth ?? 0,
      setAzimuth: set == null ? null : (lookAngles(satrec, set, lat, lng)?.azimuth ?? null),
      visible,
    });
    if (set == null) break;
    t = set + COARSE_MS;
    prev = elevation(t);
  }
  return passes;
}

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export const compassPoint = (azimuth: number) => POINTS[Math.round((((azimuth % 360) + 360) % 360) / 45) % 8];
