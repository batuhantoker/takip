import { norm, sub } from '@/lib/space/astro';
import { GM, passesWithin, planEncounters, trackSample, trackSpan, type CraftHistory, type Encounter, type HistoryEvent, type Phase, type StateTrack, type Track } from '@/lib/space/flight-history';
import { period } from '@/lib/space/two-body';
import { CROSSINGS } from '@/lib/space/heliosphere';
import { LAUNCHES } from '@/lib/space/launches';
import { jdFromMs, type Grid, type StateRow } from '@/lib/space/horizons';
import { SKY_BODIES, type SkyKey } from '@/lib/space/sky';
import { vectors } from '../horizons-fetch';

/**
 * TAKIP — a spacecraft's whole flight from JPL Horizons: where its ephemeris
 * starts and ends, the trajectory over all of it on one coarse grid, and a
 * fine stretch of the craft and the body it met around every encounter.
 */

const DAY_MIN = 1440;
/** Horizons' spacecraft ephemerides begin no earlier than the space age. */
const EARLIEST = jdFromMs(Date.UTC(1957, 9, 4));
/** How far past today JPL's predicted trajectory is followed. */
const AHEAD_DAYS = 6 * 365.25;
const COARSE_SAMPLES = 3000;
/** A climb from the pad is drawn only when Horizons picks the craft up within this long of liftoff. */
const ASCENT_MAX_DAYS = 2;
/**
 * Hours after liftoff from which Horizons' track is the real flight, where it
 * starts earlier: before that it is the post-launch orbit run backwards. ExoMars
 * TGO rode its Breeze-M stage for ten and a half hours before separating.
 */
const REAL_AFTER_HOURS: Record<number, number> = { [-143]: 12 };
const FINE_SAMPLES = 240;
const BODY_ID = Object.fromEntries(SKY_BODIES.map(b => [b.key, String(b.id)])) as Record<SkyKey, string>;
const RADIUS = Object.fromEntries(SKY_BODIES.map(b => [b.key, b.radiusKm])) as Record<SkyKey, number>;

const grid = (start: number, stop: number, stepMinutes: number): Grid => ({ start, stop, stepMinutes: Math.max(1, Math.round(stepMinutes)) });

function toTrack(rows: StateRow[]): Track | null {
  if (rows.length < 2) return null;
  return { t0: rows[0].jd, step: rows[1].jd - rows[0].jd, pos: rows.flatMap(r => r.pos.map(Math.round)) };
}

/** The span Horizons can place the craft in, narrowed from the space age to a few years ahead by its own error replies. */
async function coverage(command: string, now: number): Promise<[number, number] | null> {
  let start = EARLIEST, stop = now + AHEAD_DAYS;
  for (let k = 0; k < 5; k++) {
    // A short mission (Artemis I flew 25 days) needs a probe step well inside its span.
    const r = await vectors(command, grid(start, stop, Math.min(30 * DAY_MIN, ((stop - start) * DAY_MIN) / 8)), 'interactive');
    if (r.ok) return [start, stop];
    if (!r.gap) return null;
    const edge = jdFromMs(r.gap.boundary.getTime());
    if (r.gap.kind === 'before') start = edge + 2 / DAY_MIN;
    else stop = edge - 2 / DAY_MIN;
    if (stop - start < 1 / 24) return null;
  }
  return null;
}

async function track(command: string, g: Grid): Promise<Track | null> {
  const r = await vectors(command, g, 'interactive');
  return r.ok ? toTrack(r.rows) : null;
}

/** States relative to `center` (a Horizons centre code), velocities kept for moving along the orbit. */
async function stateTrack(command: string, g: Grid, center: string): Promise<StateTrack | null> {
  const r = await vectors(command, g, 'interactive', center);
  const t = r.ok ? toTrack(r.rows) : null;
  return r.ok && t ? { ...t, vel: r.rows.flatMap(row => row.vel.map(v => +v.toFixed(5))) } : null;
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

function closest(craft: Track, body: Track): { jd: number; km: number } {
  let best = { jd: craft.t0, km: Infinity };
  for (let i = 0; i < Math.min(craft.pos.length, body.pos.length) / 3; i++) {
    const km = norm(sub(trackSample(craft, i), trackSample(body, i)));
    if (km < best.km) best = { jd: craft.t0 + i * craft.step, km };
  }
  return best;
}

const NAME: Partial<Record<SkyKey, string>> = Object.fromEntries(SKY_BODIES.map(b => [b.key, b.name]));
const fmtKm = (km: number) => `${Math.round(km).toLocaleString('en-US')} km`;

export async function collectHistory(id: number, name: string, now = jdFromMs(Date.now())): Promise<CraftHistory | null> {
  const command = String(id);
  const span = await coverage(command, now);
  if (!span) return null;
  const [covered, stop] = span;
  const pad = LAUNCHES[id];
  const liftoff = pad ? jdFromMs(Date.parse(pad.utc)) : null;
  const start = liftoff !== null && covered < liftoff ? liftoff + (REAL_AFTER_HOURS[id] ?? 1) / 24 : covered;
  const launch = pad && liftoff !== null && start - liftoff > 2 / DAY_MIN && start - liftoff < ASCENT_MAX_DAYS
    ? { jd: liftoff, lat: pad.lat, lng: pad.lng, pad: pad.pad, vehicle: pad.vehicle } : undefined;
  const stepMin = Math.min(7 * DAY_MIN, Math.max(10, ((stop - start) * DAY_MIN) / COARSE_SAMPLES));
  const coarse = await track(command, grid(start, stop, stepMin));
  if (!coarse) return null;
  const [, coarseEnd] = trackSpan(coarse);

  const plan = planEncounters(coarse);
  const encounters: Encounter[] = await Promise.all(plan.encounters.map(async c => {
    const craft: Track[] = [], bodyTrack: Track[] = [];
    for (const [a, b] of c.spans) {
      const t0 = Math.max(start, a), t1 = Math.min(coarseEnd, b);
      if (t1 - t0 < 1 / 24) continue;
      const g = grid(t0, t1, ((t1 - t0) * DAY_MIN) / FINE_SAMPLES);
      const [ct, bt] = await Promise.all([track(command, g), track(BODY_ID[c.body], g)]);
      if (ct && bt) { craft.push(ct); bodyTrack.push(bt); }
    }
    // The tight stretch pins the closest approach down.
    const at = craft.length && c.kind !== 'launch' ? closest(craft[craft.length - 1], bodyTrack[bodyTrack.length - 1]) : { jd: c.jd, km: c.km };
    return { kind: c.kind, body: c.body, jd: at.jd, km: at.km, craft, bodyTrack };
  }));
  const phases: Phase[] = await Promise.all(plan.phases.slice(0, 4).map(async p => {
    const g = grid(p.t0, p.t1, coarse.step * DAY_MIN);
    const [bodyTrack, rel] = await Promise.all([track(BODY_ID[p.body], g), stateTrack(command, g, `500@${BODY_ID[p.body]}`)]);
    const radius = RADIUS[p.body] ?? 0;
    const dist = rel ? Array.from({ length: rel.pos.length / 3 }, (_, i) => norm(trackSample(rel, i))) : [];
    const landed = dist.length > 4 && median(dist) < radius + 60;
    const periods = rel && !landed ? Array.from({ length: rel.pos.length / 3 }, (_, i) => period(trackSample(rel, i), [rel.vel[i * 3], rel.vel[i * 3 + 1], rel.vel[i * 3 + 2]], GM[p.body] ?? 1)).filter(Number.isFinite) : [];
    return { body: p.body, t0: p.t0, t1: p.t1, bodyTrack, rel, landed, periodDays: periods.length ? median(periods) / 86_400 : null };
  }));

  // A landing gets its own stretch: the descent, minute by minute, to touchdown.
  for (const p of phases) {
    if (!p.landed || !p.rel) continue;
    const radius = RADIUS[p.body] ?? 0;
    const i = Array.from({ length: p.rel.pos.length / 3 }, (_, k) => norm(trackSample(p.rel!, k))).findIndex(d => d < radius + 100);
    if (i <= 0) continue;
    const t0 = p.rel.t0 + (i - 1) * p.rel.step, t1 = p.rel.t0 + i * p.rel.step;
    const coarseRel = await stateTrack(command, grid(t0, t1, ((t1 - t0) * DAY_MIN) / FINE_SAMPLES), `500@${BODY_ID[p.body]}`);
    const k = coarseRel ? Array.from({ length: coarseRel.pos.length / 3 }, (_, j) => norm(trackSample(coarseRel, j))).findIndex(d => d < radius + 20) : -1;
    if (!coarseRel || k < 0) continue;
    const touchdown = coarseRel.t0 + k * coarseRel.step;
    const spans: [number, number][] = [[Math.max(start, touchdown - 2), touchdown + 0.5], [touchdown - 0.125, touchdown + 0.04]];
    const craft: Track[] = [], bodyTrack: Track[] = [];
    for (const [a, b] of spans) {
      const g = grid(a, b, ((b - a) * DAY_MIN) / FINE_SAMPLES);
      const [ct, bt] = await Promise.all([track(command, g), track(BODY_ID[p.body], g)]);
      if (ct && bt) { craft.push(ct); bodyTrack.push(bt); }
    }
    // Touchdown, to the minute: the first moment within a kilometre of where the craft comes to rest.
    const tight = craft.length === 2 ? { c: craft[1], b: bodyTrack[1] } : null;
    let landedAt = touchdown;
    if (tight) {
      const n = Math.min(tight.c.pos.length, tight.b.pos.length) / 3;
      const d = Array.from({ length: n }, (_, j) => norm(sub(trackSample(tight.c, j), trackSample(tight.b, j))));
      const j = d.findIndex(x => x < d[n - 1] + 1);
      if (j >= 0) landedAt = tight.c.t0 + j * tight.c.step;
    }
    encounters.push({ kind: 'landing', body: p.body, jd: landedAt, km: radius, craft, bodyTrack });
  }
  encounters.sort((a, b) => a.jd - b.jd);

  const events: HistoryEvent[] = [];
  if (launch) events.push({ jd: launch.jd, label: `Launch · ${launch.vehicle} from ${launch.pad}`, kind: 'launch' });
  else events.push({ jd: start, label: encounters.some(e => e.kind === 'launch') ? 'Launch' : 'Ephemeris begins', kind: 'launch' });
  for (const e of encounters) {
    if (e.kind === 'flyby') events.push({ jd: e.jd, label: `${NAME[e.body]} flyby · ${fmtKm(e.km)}`, kind: 'flyby' });
    if (e.kind === 'arrival') events.push({ jd: e.jd, label: `Arrives at ${NAME[e.body]}`, kind: 'arrival' });
    if (e.kind === 'landing') events.push({ jd: e.jd, label: `Lands on ${e.body === 'moon' ? 'the Moon' : NAME[e.body]}`, kind: 'landing' });
  }
  // Close passes during a stay are flybys only when the craft is not orbiting that body (Artemis I past the Moon), else every periapsis would count.
  for (const p of phases) {
    if (!p.bodyTrack || p.landed || p.periodDays !== null) continue;
    for (const pass of passesWithin(p, coarse, p.bodyTrack).slice(0, 8)) events.push({ jd: pass.jd, label: `${NAME[p.body]} flyby · ${fmtKm(pass.km)}`, kind: 'flyby' });
  }
  for (const c of CROSSINGS.filter(x => x.craftId === id)) {
    const jd = jdFromMs(Date.parse(c.date));
    if (jd > start && jd < coarseEnd) events.push({ jd, label: `Crosses the ${c.shell === 'heliopause' ? 'heliopause' : 'termination shock'} · ${c.au} AU`, kind: 'crossing' });
  }
  if (coarseEnd < now - 1) events.push({ jd: coarseEnd, label: 'Ephemeris ends', kind: 'end' });
  else events.push({ jd: now, label: 'Now', kind: 'now' });
  events.sort((a, b) => a.jd - b.jd);

  return { id, name, launch, start, end: coarseEnd, fetchedJd: now, coarse, encounters, phases, events };
}
