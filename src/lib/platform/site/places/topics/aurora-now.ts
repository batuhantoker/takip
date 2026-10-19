import { compassPoint, sunAltitude } from '@/lib/feeds/satellites/pass';
import { ownApi } from '../../live/own-api';
import { kmBetween } from './sky-rules';
import { localClock, type LocalClock } from './sky-time';

/**
 * The aurora near a place right now, from NOAA's OVATION nowcast, and whether it is dark enough there to
 * see it. OVATION looks about 30 minutes ahead and ignores cloud and moonlight, so a page answers "now" and
 * "dark from HH:MM", never "tonight".
 *
 * The cases, and what a page says for each (aurora-copy.ts):
 * - unavailable: no nowcast, or one observed over an hour ago. Only the darkness lines.
 * - no-dark: the sky does not get dark enough in the next two days (summer near the poles). Say when it next does.
 * - light: day or twilight now. The chance overhead, and when it is fully dark.
 * - overhead: dark, and 10% or more overhead. The chance, and until when it stays dark.
 * - horizon: dark, under 10% overhead but 10% or more within 500 km. How far, and which way to look.
 * - quiet: dark, and under 10% everywhere within 500 km.
 */

/** The shape of /api/aurora: cells under 5% are left out, so a missing cell means under 5%, not unknown. */
export interface OvationGrid {
  observed_at: string | null;
  forecast_at: string | null;
  /** [lng −180…180, lat, %], whole degrees. */
  cells: [number, number, number][];
  max_pct: number;
}

export async function auroraGridNow(revalidate = 300): Promise<OvationGrid | null> {
  const grid = await ownApi<OvationGrid>('/api/aurora', revalidate);
  return grid && Array.isArray(grid.cells) ? grid : null;
}

/** % chance of aurora overhead at whole-degree grid nodes, 0 where the route left the cell out. */
export type Ovation = (lng: number, lat: number) => number;

export function ovationLookup(grid: OvationGrid): Ovation {
  const at = new Map<number, number>();
  const key = (lng: number, lat: number) => (((Math.round(lng) % 360) + 360) % 360) * 1000 + (Math.round(lat) + 90);
  for (const [lng, lat, p] of grid.cells) at.set(key(lng, lat), p);
  return (lng, lat) => at.get(key(lng, lat)) ?? 0;
}

/** Interpolated between the four nodes around the place. */
export function chanceAt(look: Ovation, lat: number, lng: number): number {
  const x0 = Math.floor(lng), y0 = Math.floor(lat);
  const fx = lng - x0, fy = lat - y0;
  const y1 = Math.min(90, y0 + 1);
  return look(x0, y0) * (1 - fx) * (1 - fy) + look(x0 + 1, y0) * fx * (1 - fy) + look(x0, y1) * (1 - fx) * fy + look(x0 + 1, y1) * fx * fy;
}

export const AURORA_NEAR_KM = 500;
/** The chance that counts as worth going out for, overhead or low in the sky. */
export const AURORA_WORTH_PCT = 10;
/** A nowcast observed longer ago than this is no longer "now": a cache can hand back an old one after a quiet spell. */
export const AURORA_MAX_AGE_MS = 60 * 60_000;

export interface Nearby { pct: number; km: number; toward: string }

/** The likeliest node within `km`, the nearer one on a tie. */
export function likeliestNear(look: Ovation, lat: number, lng: number, km = AURORA_NEAR_KM): Nearby | null {
  const dLat = Math.ceil(km / 111);
  const dLng = Math.min(180, Math.ceil(km / (111 * Math.max(Math.cos(Math.min(89, Math.abs(lat) + dLat) * (Math.PI / 180)), 0.02))));
  let best: Nearby | null = null;
  for (let y = Math.ceil(lat - dLat); y <= Math.floor(lat + dLat); y++) {
    if (Math.abs(y) > 90) continue;
    for (let x = Math.ceil(lng - dLng); x <= Math.floor(lng + dLng); x++) {
      const pct = look(x, y);
      if (!pct) continue;
      const d = kmBetween({ lat, lng }, { lat: y, lng: x });
      if (d > km || (best && (pct < best.pct || (pct === best.pct && d >= best.km)))) continue;
      best = { pct, km: Math.round(d), toward: compassPoint(bearing(lat, lng, y, x)) };
    }
  }
  return best;
}

function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = Math.PI / 180;
  const y = Math.sin((lng2 - lng1) * r) * Math.cos(lat2 * r);
  const x = Math.cos(lat1 * r) * Math.sin(lat2 * r) - Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lng2 - lng1) * r);
  return ((Math.atan2(y, x) / r) % 360 + 360) % 360;
}

/** Sun at or below −12° (nautical night): dark enough for an ordinary aurora. Above −6° only a bright one shows. */
export const DARK_SUN = -12;
export const TWILIGHT_SUN = -6;

/** Too light for any aurora, light enough that only a bright one shows, or dark. */
export type SkyState = 'light' | 'twilight' | 'dark';

export interface Darkness {
  /** The sun's elevation now, to 0.1°. */
  sun: number;
  state: SkyState;
  /** When the dark ends, if it is dark now; null if not within two days (polar night). */
  darkUntil: number | null;
  /** When it next gets dark, if it is not dark now; null if not within two days. */
  darkFrom: number | null;
  /** When it is next dark at all, looking months ahead, if not within two days. */
  darkAgain: number | null;
}

const MIN = 60_000;
const NEAR_HOURS = 48;
const FAR_DAYS = 200;

/** The first moment in (a, b] where darkness flips, to the minute. */
function edge(a: number, b: number, lat: number, lng: number): number {
  const darkAtA = sunAltitude(a, lat, lng) <= DARK_SUN;
  while (b - a > MIN) {
    const mid = (a + b) / 2;
    if ((sunAltitude(mid, lat, lng) <= DARK_SUN) === darkAtA) a = mid;
    else b = mid;
  }
  return Math.round(b / MIN) * MIN;
}

function nextFlip(from: number, lat: number, lng: number, stepMs: number, untilMs: number): number | null {
  const dark = sunAltitude(from, lat, lng) <= DARK_SUN;
  for (let t = from; t < untilMs; t += stepMs) {
    const next = Math.min(t + stepMs, untilMs);
    if ((sunAltitude(next, lat, lng) <= DARK_SUN) !== dark) return edge(t, next, lat, lng);
  }
  return null;
}

export function darkness(now: number, lat: number, lng: number): Darkness {
  const sun = sunAltitude(now, lat, lng);
  const state: SkyState = sun <= DARK_SUN ? 'dark' : sun <= TWILIGHT_SUN ? 'twilight' : 'light';
  const near = now + NEAR_HOURS * 3_600_000;
  const flip = nextFlip(now, lat, lng, 10 * MIN, near);
  const out: Darkness = { sun: Math.round(sun * 10) / 10, state, darkUntil: null, darkFrom: null, darkAgain: null };
  if (state === 'dark') out.darkUntil = flip;
  else if (flip != null) out.darkFrom = flip;
  else out.darkAgain = nextFlip(near, lat, lng, 30 * MIN, now + FAR_DAYS * 86_400_000);
  return out;
}

export type AuroraCase = 'unavailable' | 'no-dark' | 'light' | 'overhead' | 'horizon' | 'quiet';

export interface AuroraPlace { lat: number; lng: number; tz: string }

export interface AuroraReport {
  case: AuroraCase;
  tz: string;
  now: number;
  observedAt: string | null;
  forecastAt: string | null;
  /** % overhead, whole. Under 5 means NOAA left it out as under 5%. */
  here: number | null;
  nearby: Nearby | null;
  /** The highest chance anywhere on Earth now, for "a quiet night everywhere" lines. */
  worldMax: number | null;
  darkness: Darkness;
  /** darkUntil, darkFrom or darkAgain on the place's clock. */
  clock: { darkUntil: LocalClock | null; darkFrom: LocalClock | null; darkAgain: LocalClock | null };
}

export function auroraReport(grid: OvationGrid | null, place: AuroraPlace, now: number): AuroraReport {
  const d = darkness(now, place.lat, place.lng);
  const at = (ms: number | null) => (ms == null ? null : localClock(ms, place.tz));
  const base: AuroraReport = {
    case: 'unavailable', tz: place.tz, now, observedAt: grid?.observed_at ?? null, forecastAt: grid?.forecast_at ?? null,
    here: null, nearby: null, worldMax: grid ? Math.round(grid.max_pct) : null, darkness: d,
    clock: { darkUntil: at(d.darkUntil), darkFrom: at(d.darkFrom), darkAgain: at(d.darkAgain) },
  };
  const observed = grid?.observed_at ? Date.parse(grid.observed_at) : NaN;
  if (!grid || now - observed > AURORA_MAX_AGE_MS) return base;
  const look = ovationLookup(grid);
  const here = Math.round(chanceAt(look, place.lat, place.lng));
  const nearby = likeliestNear(look, place.lat, place.lng);
  const report = { ...base, here, nearby };
  if (d.state !== 'dark') return { ...report, case: d.darkFrom == null ? 'no-dark' : 'light' };
  if (here >= AURORA_WORTH_PCT) return { ...report, case: 'overhead' };
  return { ...report, case: nearby && nearby.pct >= AURORA_WORTH_PCT ? 'horizon' : 'quiet' };
}
