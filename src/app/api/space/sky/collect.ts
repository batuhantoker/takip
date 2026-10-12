import { apparentRaDec, moonPhase, norm, positionAt, scale, sub } from '@/lib/space/astro';
import { jdFromMs, type StateRow, type Vec3 } from '@/lib/space/horizons';
import { SKY_BODIES, type SkyBody, type SkyKey, type SkyPayload, type SkySample } from '@/lib/space/sky';
import { vectors } from '../horizons-fetch';

/**
 * TAKIP — Sun, Moon and planets from JPL Horizons: one heliocentric vector
 * query per body, hourly from an hour ago to a day ahead.
 */

const HOUR_MS = 3_600_000;
const HOURS_AHEAD = 24;

export interface SkyState {
  payload: SkyPayload;
  /** Heliocentric rows per body, for the fleet's classification and distances. */
  rows: Partial<Record<SkyKey, StateRow[]>>;
  epochJd: number;
}

export async function collectSky(now = Date.now()): Promise<SkyState> {
  const t0 = Math.floor(now / HOUR_MS) * HOUR_MS;
  const grid = { start: jdFromMs(t0 - HOUR_MS), stop: jdFromMs(t0 + HOURS_AHEAD * HOUR_MS), stepMinutes: 60 };
  const rows: Partial<Record<SkyKey, StateRow[]>> = {};
  await Promise.all(SKY_BODIES.filter(b => b.key !== 'sun').map(async b => {
    const reply = await vectors(String(b.id), grid, 'interactive');
    if (reply.ok) rows[b.key] = reply.rows;
    else console.warn(`[TAKIP] Horizons ${b.name}: ${reply.error}`);
  }));
  const earth = rows.earth;
  if (!earth?.length || !rows.moon?.length) throw new Error('Horizons returned no Earth or Moon ephemeris');
  rows.sun = earth.map(r => ({ jd: r.jd, pos: [0, 0, 0] as Vec3, vel: [0, 0, 0] as Vec3 }));

  const epochJd = jdFromMs(t0);
  const at = (key: SkyKey) => rows[key]!.find(r => Math.abs(r.jd - epochJd) < 1e-6) ?? rows[key]![0];
  const geoOf = (key: SkyKey, i: number): Vec3 => sub(rows[key]![i].pos, earth[i].pos);

  const bodies: SkyBody[] = [];
  for (const def of SKY_BODIES) {
    const own = rows[def.key];
    if (!own?.length) continue;
    const track: SkySample[] = def.key === 'earth' ? [] : own.map((r, i) => {
      const geo = geoOf(def.key, i);
      const { ra, dec } = apparentRaDec(geo, r.jd);
      const sample: SkySample = { jd: +r.jd.toFixed(6), ra: +ra.toFixed(4), dec: +dec.toFixed(4), km: Math.round(norm(geo)) };
      if (def.key === 'moon') {
        const phase = moonPhase(scale(earth[i].pos, -1), geo);
        sample.illum = +phase.illumination.toFixed(4);
        sample.elong = +phase.elongation.toFixed(2);
      }
      return sample;
    });
    const state = at(def.key);
    const states = def.key === 'sun' ? [] : own.map(r => ({
      jd: +r.jd.toFixed(6),
      pos: r.pos.map(x => Math.round(x)) as Vec3,
      vel: r.vel.map(x => +x.toFixed(6)) as Vec3,
    }));
    bodies.push({ key: def.key, name: def.name, kind: def.kind, color: def.color, radiusKm: def.radiusKm, helio: state.pos, vel: state.vel, states, track });
  }
  return { payload: { epoch: new Date(t0).toISOString(), bodies }, rows, epochJd };
}

/** A body's heliocentric position at `jd`, from the hourly rows. */
export function helioAt(state: SkyState, key: SkyKey, jd: number): Vec3 | null {
  const r = state.rows[key];
  return r ? positionAt(r, jd) : null;
}
