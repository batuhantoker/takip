
import { NextResponse } from 'next/server';
import { propagateTLE } from '@/lib/feeds/satellites/orbit';
import { classifySatellite } from '@/lib/feeds/satellites/classify';
import { encodeElements } from '@/lib/feeds/satellites/elements';
import { prebuild, servePrebuilt, type Prebuilt } from '@/lib/core/net/prebuilt';
import { record } from '@takip/archive/recorder';
import { downloadDue, dueGroups, emptySchedule, type Schedule, type Tle, UPDATE_MS, USER_AGENT } from './celestrak';

export const maxDuration = 60;

/**
 * TAKIP — Satellite Tracking API
 * Fetches TLE data from multiple sources with fallbacks
 * Computes real-time positions using simplified SGP4
 */

/**
 * Position for one TLE, in the shape this route returns.
 *
 * This used to be a hand-rolled two-body Kepler solve: no J2, no drag, and it
 * reported geocentric latitude and altitude above a 6371 km sphere. Good
 * enough for a dot on a flat map, but the globe now draws satellites at their
 * altitude, and an orbit placed by that solve sits visibly off the satellite
 * it belongs to. src/lib/feeds/satellites/orbit.ts wraps satellite.js (already a dependency,
 * previously unused) for real SGP4/SDP4 and geodetic coordinates.
 */
function propagateSGP4Simple(line1: string, line2: string, when?: Date): { lat: number; lng: number; alt: number } | null {
  const p = propagateTLE(line1, line2, when);
  if (!p) return null;
  return {
    lat: Math.round(p.lat * 10000) / 10000,
    lng: Math.round(p.lng * 10000) / 10000,
    alt: Math.round(p.altKm),
  };
}

// SatNOGS DB (CC BY-SA 4.0): only when CelesTrak has given us nothing, and at most once per update window.
const SATNOGS_API = 'https://db.satnogs.org/api/tle/?format=json';

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const CACHE_DIR = join(process.cwd(), '.next', 'cache');
const CACHE_FILE = join(CACHE_DIR, 'satellites-tle-cache.json');
/** Element sets stay usable for days; a day-old cache beats an empty map after a restart. */
const DISK_MAX_AGE_MS = 24 * 60 * 60_000;

type SatState = {
  sats: Tle[];
  time: number;
  source: string;
  schedule: Schedule;
  /** The latest download of each group in this process. */
  groups: Map<string, Tle[]>;
  satnogsAt: number;
  refreshing?: Promise<void>;
};

function saveToDisk(state: SatState) {
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify({ time: state.time, sats: state.sats, schedule: state.schedule, satnogsAt: state.satnogsAt }));
  } catch { /* non-critical */ }
}

/** The schedule is restored however old the data is: a restart must not reset CelesTrak's clock. */
function loadState(): SatState {
  const state: SatState = { sats: [], time: 0, source: 'memory-cache', schedule: emptySchedule(), groups: new Map(), satnogsAt: 0 };
  try {
    if (!existsSync(CACHE_FILE)) return state;
    const data = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
    if (data.schedule) state.schedule = { ...emptySchedule(), ...data.schedule };
    state.satnogsAt = data.satnogsAt ?? 0;
    if (data.sats?.length > 0 && Date.now() - data.time < DISK_MAX_AGE_MS) {
      state.sats = data.sats;
      state.time = data.time;
    }
  } catch { /* corrupted cache */ }
  return state;
}

// On globalThis: dev reloads re-run this module, and a fresh state would forget what CelesTrak was asked.
const holder = globalThis as unknown as { satelliteState?: SatState };
const state = (holder.satelliteState ??= loadState());

const noradOf = (sat: Tle) => sat.line1.substring(2, 7).trim();

/** The element-set columns for the map (elements.ts), built once per set of TLEs. */
let elements: { from: Tle[]; body: Prebuilt } | null = null;
function elementsOf(sats: Tle[], meta: Record<string, unknown>): Prebuilt {
  if (elements?.from !== sats) elements = { from: sats, body: prebuild({ ...meta, ...encodeElements(sats) }) };
  return elements.body;
}

async function fetchSatnogs(): Promise<Tle[]> {
  const started = Date.now();
  try {
    const res = await fetch(SATNOGS_API, { signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json', 'User-Agent': USER_AGENT } });
    const text = await res.text();
    record('satnogs', { url: SATNOGS_API, status: res.status, ms: Date.now() - started }, res.ok ? text : null);
    if (!res.ok) return [];
    const seenNames = new Set<string>();
    const sats: Tle[] = [];
    for (const item of JSON.parse(text) as { tle0?: string; tle1?: string; tle2?: string }[]) {
      const name = (item.tle0 || '').trim().replace(/^0\s+/, '');
      if (name && item.tle1 && item.tle2 && !seenNames.has(name)) {
        seenNames.add(name);
        sats.push({ name, line1: item.tle1.trim(), line2: item.tle2.trim() });
      }
    }
    return sats;
  } catch (err) {
    record('satnogs', { url: SATNOGS_API, status: 0, ms: Date.now() - started, err: String(err) }, null);
    console.error('SatNOGS fetch error:', err);
    return [];
  }
}

/** Downloads only what CelesTrak's policy allows right now; usually nothing. */
async function refresh() {
  const asked = dueGroups(state.schedule, Date.now()).length > 0;
  const fresh = await downloadDue(state.schedule);
  if (fresh.size) {
    for (const [url, sats] of fresh) state.groups.set(url, sats);
    const seen = new Set<string>();
    const merged: Tle[] = [];
    for (const sats of state.groups.values()) {
      for (const sat of sats) if (!seen.has(noradOf(sat))) { seen.add(noradOf(sat)); merged.push(sat); }
    }
    // Groups not downloaded in this process yet keep their objects from the previous merge.
    let kept = 0;
    for (const sat of state.sats) if (!seen.has(noradOf(sat))) { seen.add(noradOf(sat)); merged.push(sat); kept++; }
    state.sats = merged;
    state.time = Date.now();
    state.source = `celestrak (${merged.length} TLEs: ${merged.length - kept} new, ${kept} cached)`;
  }
  let usedSatnogs = false;
  if (!state.sats.length && Date.now() - state.satnogsAt >= UPDATE_MS) {
    state.satnogsAt = Date.now();
    usedSatnogs = true;
    const sats = await fetchSatnogs();
    if (sats.length) {
      state.sats = sats;
      state.time = Date.now();
      state.source = 'satnogs-api';
    }
  }
  if (asked || usedSatnogs) saveToDisk(state);
}

export async function GET(request: Request) {
  // `at` (epoch s) is for replay: today's element sets propagated to that moment, nothing recorded.
  const params = new URL(request.url).searchParams;
  const atParam = params.get('at');
  // Replay propagates in the browser from here on, so it asks for the element sets once.
  const withTle = params.get('tle') === '1';
  // A handful by catalogue number (?norad=40697,42063), for one window's passes instead of all 18k.
  // ?format=elements: the sets alone, for the map to place and label itself; `at` and `tle` don't apply.
  const asElements = params.get('format') === 'elements';
  const only = params.get('norad') ? new Set(params.get('norad')!.split(',').map(n => n.trim().padStart(5, '0'))) : null;
  const at = atParam === null || atParam === '' ? undefined : Number(atParam);
  if (at !== undefined && !Number.isFinite(at)) return NextResponse.json({ error: 'bad_time' }, { status: 400 });
  // Whole minutes, so neighbouring requests share a cached answer.
  const when = at === undefined ? undefined : new Date(Math.min(Math.round(at / 60) * 60_000, Date.now()));
  try {
    state.refreshing ??= refresh().finally(() => { state.refreshing = undefined; });
    // Wait only when there is nothing to show; otherwise the refresh lands for the next caller.
    if (!state.sats.length) await state.refreshing;
    let allSats: Tle[] = state.sats;
    let source = state.source;

    // Emergency Fallback if cache is totally empty
    if (allSats.length === 0) {
      const issFallback = "1 25544U 98067A   24146.40251785  .00015505  00000-0  27885-3 0  9997\n2 25544  51.6402 189.7042 0004381 334.8091 106.8778 15.50091157455243";
      allSats = [{ name: 'ISS (FALLBACK)', line1: issFallback.split('\n')[0], line2: issFallback.split('\n')[1] }];
      source = 'emergency-fallback';
    }

    if (asElements && !only) {
      const meta = { source, total: allSats.length, timestamp: new Date(state.time || Date.now()).toISOString() };
      // Unchanged until CelesTrak's sets are, so a returning map revalidates instead of downloading again.
      return servePrebuilt(request, elementsOf(allSats, meta), 'public, max-age=300, stale-while-revalidate=3600');
    }
    if (only) allSats = allSats.filter(sat => only.has(sat.line1.substring(2, 7).trim().padStart(5, '0')));

    // No artificial cap — propagate all satellites, MapLibre handles it fine
    const satellites = [];
    for (const sat of allSats) {
      const pos = propagateSGP4Simple(sat.line1, sat.line2, when);
      if (!pos) continue;

      const { mission, color, category } = classifySatellite(sat.name);
      satellites.push({
        name: sat.name,
        lat: pos.lat,
        lng: pos.lng,
        alt: pos.alt,
        mission,
        color,
        category,
        noradId: sat.line1.substring(2, 7).trim(),
        ...(withTle ? { line1: sat.line1, line2: sat.line2 } : {}),
      });
    }

    const cacheControl = satellites.length < 10 
      ? 'no-store, max-age=0' 
      : 'public, s-maxage=120, stale-while-revalidate=300';

    // Count by category
    const categoryCounts: Record<string, number> = {};
    for (const s of satellites) {
      categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1;
    }

    return NextResponse.json({
      satellites,
      total: satellites.length,
      category_counts: categoryCounts,
      source,
      raw_count: allSats.length,
      timestamp: (when ?? new Date()).toISOString(),
    }, {
      headers: {
        'Cache-Control': cacheControl,
      },
    });
  } catch (error) {
    console.error('Satellite fetch error:', error);
    return NextResponse.json({ satellites: [], error: 'Failed to fetch satellite data' }, { status: 500 });
  }
}

