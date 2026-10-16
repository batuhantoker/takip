import { AU_KM, wrap180 } from '@/lib/space/astro';
import { jdFromMs, type Grid } from '@/lib/space/horizons';
import { MISSION_NOTES } from '@/lib/space/craft/mission-notes';
import { rowTimeMs, thin, type LightingPoint, type SurfaceOrbiter, type SurfaceRover, type TrackPoint } from '@/lib/space/bodies/surface';
import { SKY_BODIES } from '@/lib/space/sky';
import type { GlobeWorldId } from '@/lib/space/worlds';
import { fleetSnapshot } from '../fleet/collect';
import { observer } from '../horizons-fetch';

/**
 * TAKIP — orbiters over the Moon and Mars, and NASA's Mars rovers.
 *
 * Orbiters: Horizons observer tables with the craft as the observer, which give
 * the point beneath it (ObsSub-LON/LAT) in the body's own frame. Which craft
 * orbit which body comes from the fleet sweep; the defaults cover a cold start.
 *
 * Rovers: the waypoint files behind NASA's public "Where is the rover?" maps
 * (MMGIS on mars.nasa.gov). Public but undocumented, so read defensively.
 */

const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
const STEP_MIN = 3;
const BEFORE_MIN = 60;
const AFTER_MIN = 180;
/** Below this the "orbiter" is a lander sitting on the surface. */
const SURFACE_KM = 50;

const CENTRE: Record<GlobeWorldId, string> = { moon: '301', mars: '499' };
const DEFAULT_ORBITERS: Record<GlobeWorldId, { id: number; name: string }[]> = {
  moon: [{ id: -85, name: 'Lunar Reconnaissance Orbiter' }, { id: -155, name: 'Danuri (KPLO)' }, { id: -152, name: 'Chandrayaan-2 orbiter' }],
  mars: [
    { id: -74, name: 'Mars Reconnaissance Orbiter' }, { id: -53, name: '2001 Mars Odyssey' }, { id: -41, name: 'Mars Express' },
    { id: -143, name: 'ExoMars Trace Gas Orbiter' }, { id: -62, name: 'Hope (Emirates Mars Mission)' },
  ],
};

async function orbiterIds(body: GlobeWorldId): Promise<{ id: number; name: string }[]> {
  const fleet = await fleetSnapshot(0);
  const region = body === 'moon' ? 'moon' : 'mars';
  const fromFleet = fleet.craft.filter(c => c.region === region).map(c => ({ id: c.id, name: c.name }));
  return fromFleet.length ? fromFleet : DEFAULT_ORBITERS[body];
}

async function groundTrack(body: GlobeWorldId, id: number, grid: Grid): Promise<TrackPoint[] | null> {
  const reply = await observer({ COMMAND: CENTRE[body], CENTER: `500@${id}`, QUANTITIES: '14,20' }, grid, 'interactive');
  if (!reply.ok || !reply.sense) return null;
  const radius = SKY_BODIES.find(b => b.key === body)!.radiusKm;
  const track: TrackPoint[] = [];
  for (const row of reply.rows) {
    const t = rowTimeMs(row);
    const lon = Number(row['ObsSub-LON']), lat = Number(row['ObsSub-LAT']), delta = Number(row.delta);
    if (![t, lon, lat, delta].every(Number.isFinite)) continue;
    track.push({ t, lat: +lat.toFixed(4), lng: +wrap180(reply.sense === 'west' ? -lon : lon).toFixed(4), altKm: Math.round(delta * AU_KM - radius) });
  }
  return track;
}

export async function collectOrbiters(body: GlobeWorldId, now = Date.now()): Promise<SurfaceOrbiter[]> {
  const t0 = Math.floor(now / (STEP_MIN * 60_000)) * STEP_MIN * 60_000;
  const grid = { start: jdFromMs(t0 - BEFORE_MIN * 60_000), stop: jdFromMs(t0 + AFTER_MIN * 60_000), stepMinutes: STEP_MIN };
  const ids = await orbiterIds(body);
  const out = await Promise.all(ids.map(async ({ id, name }): Promise<SurfaceOrbiter | null> => {
    try {
      const track = await groundTrack(body, id, grid);
      // Null too for craft Horizons cannot observe from ("cannot find station file"), e.g. ARTEMIS P1/P2.
      if (!track?.length || Math.max(...track.map(p => p.altKm)) < SURFACE_KM) return null;
      const note = MISSION_NOTES[id];
      return { id, name, agency: note?.agency ?? null, summary: note?.summary ?? null, track };
    } catch (e) {
      console.warn(`[TAKIP] ${body} orbiter ${id}:`, e instanceof Error ? e.message : e);
      return null;
    }
  }));
  return out.filter((o): o is SurfaceOrbiter => o !== null);
}

const lon = (v: string, sense: 'east' | 'west') => wrap180(sense === 'west' ? -Number(v) : Number(v));

/** Hourly sub-solar and sub-Earth points on the body, from an hour ago to four hours ahead. */
export async function collectLighting(body: GlobeWorldId, now = Date.now()): Promise<LightingPoint[]> {
  const t0 = Math.floor(now / 3_600_000) * 3_600_000;
  const grid = { start: jdFromMs(t0 - 3_600_000), stop: jdFromMs(t0 + 4 * 3_600_000), stepMinutes: 60 };
  const reply = await observer({ COMMAND: CENTRE[body], CENTER: '500@399', QUANTITIES: '14,15' }, grid, 'interactive');
  if (!reply.ok || !reply.sense) return [];
  const sense = reply.sense;
  return reply.rows.flatMap(row => {
    const t = rowTimeMs(row);
    const sun: [number, number] = [lon(row['SunSub-LON'], sense), Number(row['SunSub-LAT'])];
    const earth: [number, number] = [lon(row['ObsSub-LON'], sense), Number(row['ObsSub-LAT'])];
    return [t, ...sun, ...earth].every(Number.isFinite) ? [{ t, sun, earth }] : [];
  });
}

const MMGIS = 'https://mars.nasa.gov/mmgis-maps';
const ROVERS = [
  { key: 'perseverance', name: 'Perseverance', agency: 'NASA', mission: 'M20' },
  { key: 'curiosity', name: 'Curiosity', agency: 'NASA', mission: 'MSL' },
] as const;

interface Feature { properties?: Record<string, unknown>; geometry?: { type?: string; coordinates?: unknown } }

async function getJson(url: string): Promise<{ features?: Feature[] }> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  return res.json();
}

/** Every [lng, lat] in a traverse file, in file order, whatever mix of line types it holds. */
export function traversePoints(features: Feature[]): [number, number][] {
  const out: [number, number][] = [];
  const walk = (c: unknown) => {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === 'number' && typeof c[1] === 'number') { out.push([+c[0].toFixed(6), +c[1].toFixed(6)]); return; }
    c.forEach(walk);
  };
  for (const f of features) walk(f.geometry?.coordinates);
  return out;
}

export async function collectRovers(): Promise<SurfaceRover[]> {
  const out = await Promise.all(ROVERS.map(async (r): Promise<SurfaceRover | null> => {
    try {
      const [current, traverse] = await Promise.all([
        getJson(`${MMGIS}/${r.mission}/Layers/json/${r.mission}_waypoints_current.json`),
        getJson(`${MMGIS}/${r.mission}/Layers/json/${r.mission}_traverse.json`).catch(() => ({ features: [] })),
      ]);
      const p = current.features?.[0]?.properties ?? {};
      const lat = Number(p.lat), lng = Number(p.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const sol = Number(p.sol), drive = Number(p.dist_total_m);
      return {
        key: r.key, name: r.name, agency: r.agency,
        sol: Number.isFinite(sol) ? sol : null,
        lat, lng: wrap180(lng),
        driveKm: Number.isFinite(drive) ? +(drive / 1000).toFixed(2) : null,
        traverse: thin(traversePoints(traverse.features ?? []), 2500),
      };
    } catch (e) {
      console.warn(`[TAKIP] ${r.name} position:`, e instanceof Error ? e.message : e);
      return null;
    }
  }));
  return out.filter((r): r is SurfaceRover => r !== null);
}
