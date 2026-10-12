import { C_KM_S, norm, sub } from '@/lib/space/astro';
import { classify, craftName, isCandidate, REGION_FRAME, REGION_ORDER, TRAIL_REGIONS, type FleetCraft, type FleetPayload, type Neighbours } from '@/lib/space/fleet';
import { parseMajorBodies, type MajorBody, type StateRow, type Vec3 } from '@/lib/space/horizons';
import { MISSION_NOTES } from '@/lib/space/mission-notes';
import { SKY_BODIES } from '@/lib/space/sky';
import { coveredVectors, majorBodies } from '../horizons-fetch';
import { loadSky } from '../sky/load';
import type { SkyState } from '../sky/collect';

/**
 * TAKIP — the fleet sweep: every spacecraft in Horizons' catalogue, one vector
 * query each (a weekly trail over the past year plus the sweep epoch).
 *
 * A cold sweep is a couple of hundred lookups, so it runs in the background and
 * the route answers with whatever has landed; craft whose ephemeris does not
 * cover the epoch are set aside for a week instead of being asked every sweep.
 */

const SWEEP_MS = 6 * 3_600_000;
const DEAD_MS = 7 * 86_400_000;
const CATALOGUE_MS = 86_400_000;
const TRAIL_DAYS = 364;
const TRAIL_STEP_DAYS = 7;

const state = {
  epochMs: 0,
  sweptAt: 0,
  craft: new Map<number, FleetCraft>(),
  dead: new Map<number, number>(),
  catalogue: [] as MajorBody[],
  catalogueAt: 0,
  pending: 0,
  running: null as Promise<void> | null,
};

async function catalogue(): Promise<MajorBody[]> {
  if (state.catalogue.length && Date.now() - state.catalogueAt < CATALOGUE_MS) return state.catalogue;
  const list = parseMajorBodies(await majorBodies()).filter(isCandidate);
  if (list.length) {
    state.catalogue = list;
    state.catalogueAt = Date.now();
  }
  return state.catalogue;
}

function neighbours(sky: SkyState): Neighbours | null {
  const pos = (key: (typeof SKY_BODIES)[number]['key']) => sky.payload.bodies.find(b => b.key === key)?.helio;
  const earth = pos('earth'), moon = pos('moon');
  if (!earth || !moon) return null;
  return { earth, moon, mercury: pos('mercury'), venus: pos('venus'), mars: pos('mars'), jupiter: pos('jupiter'), saturn: pos('saturn') };
}

const round = (v: Vec3): Vec3 => [Math.round(v[0]), Math.round(v[1]), Math.round(v[2])];

function build(body: MajorBody, rows: StateRow[], epochJd: number, sky: SkyState, n: Neighbours): FleetCraft | null {
  const now = rows.find(r => Math.abs(r.jd - epochJd) < 1e-4);
  if (!now) return null;
  const region = classify(now.pos, n);
  const frame = REGION_FRAME[region];
  const frameBody = frame === 'sun' ? null : sky.payload.bodies.find(b => b.key === frame);
  const framePos = frameBody?.helio ?? [0, 0, 0] as Vec3;
  const frameVel = frameBody?.vel ?? [0, 0, 0] as Vec3;
  const earthKm = norm(sub(now.pos, n.earth));
  const note = MISSION_NOTES[body.id];
  return {
    id: body.id,
    name: note?.name ?? craftName(body.name),
    cospar: body.designation || null,
    agency: note?.agency ?? null,
    summary: note?.summary ?? null,
    ended: note?.ended ?? null,
    region,
    helio: round(now.pos),
    vel: now.vel,
    sunKm: Math.round(norm(now.pos)),
    earthKm: Math.round(earthKm),
    lightSec: +(earthKm / C_KM_S).toFixed(1),
    speedKmS: +norm(sub(now.vel, frameVel)).toFixed(3),
    speedFrame: SKY_BODIES.find(b => b.key === frame)?.name ?? 'Sun',
    frame,
    rel: round(sub(now.pos, framePos)),
    relVel: sub(now.vel, frameVel).map(v => +v.toFixed(6)) as Vec3,
    trail: TRAIL_REGIONS.has(region) ? rows.filter(r => r !== now).map(r => round(r.pos)) : [],
  };
}

async function sweep(): Promise<void> {
  const sky = await loadSky();
  const n = sky && neighbours(sky);
  if (!sky || !n) throw new Error('No Sun/Moon/planet positions to sweep against');
  const epochJd = sky.epochJd;
  state.epochMs = Date.parse(sky.payload.epoch);
  const grid = { start: epochJd - TRAIL_DAYS, stop: epochJd, stepMinutes: TRAIL_STEP_DAYS * 1440 };

  const now = Date.now();
  const todo = (await catalogue()).filter(b => (state.dead.get(b.id) ?? 0) < now);
  state.pending = todo.length;
  await Promise.all(todo.map(async body => {
    try {
      const reply = await coveredVectors(String(body.id), grid, 'sweep');
      const craft = reply.ok ? build(body, reply.rows, epochJd, sky, n) : null;
      if (craft) {
        state.craft.set(body.id, craft);
      } else if (reply.ok || reply.gap) {
        // The ephemeris exists but not at the epoch: ended, or not launched yet.
        state.craft.delete(body.id);
        state.dead.set(body.id, now + DEAD_MS);
      }
    } catch (e) {
      // A network failure keeps whatever this craft had from the last sweep.
      console.warn(`[TAKIP] Horizons ${body.id} ${body.name}:`, e instanceof Error ? e.message : e);
    } finally {
      state.pending--;
    }
  }));
  state.sweptAt = Date.now();
}

function ensureSweep(): Promise<void> | null {
  if (state.running) return state.running;
  if (state.sweptAt && Date.now() - state.sweptAt < SWEEP_MS) return null;
  state.running = sweep()
    .catch(e => console.warn('[TAKIP] fleet sweep failed:', e instanceof Error ? e.message : e))
    .finally(() => { state.running = null; });
  return state.running;
}

/** The fleet as it stands, after waiting up to `waitMs` for a sweep in progress. */
export async function fleetSnapshot(waitMs: number): Promise<FleetPayload> {
  const running = ensureSweep();
  if (running) await Promise.race([running, new Promise(r => setTimeout(r, waitMs))]);
  const order = (c: FleetCraft) => REGION_ORDER.indexOf(c.region);
  const craft = [...state.craft.values()].sort((a, b) => order(a) - order(b) || a.earthKm - b.earthKm);
  return {
    epoch: state.epochMs ? new Date(state.epochMs).toISOString() : new Date().toISOString(),
    craft,
    pending: state.running ? Math.max(0, state.pending) : 0,
    candidates: state.catalogue.length,
  };
}
