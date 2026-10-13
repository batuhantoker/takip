import { jdFromMs, type StateRow, type Vec3 } from '@/lib/space/horizons';
import { DWARF_PLANETS, parseMpcLine, positionFromElements, VISITORS, type DistantRow, type OuterBody, type OuterBodyDef, type OuterPayload } from '@/lib/space/outer';
import { AU_KM } from '@/lib/space/astro';
import { coveredVectors } from '../horizons-fetch';

/**
 * TAKIP — past Neptune: the dwarf planets and interstellar visitors from JPL
 * Horizons, and the Minor Planet Center's orbits for every distant minor planet.
 */

const HOUR_MS = 3_600_000;
const DAY = 1440;
const DISTANT_URL = 'https://www.minorplanetcenter.net/iau/MPCORB/Distant.txt';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';

const round = (v: Vec3): Vec3 => [Math.round(v[0]), Math.round(v[1]), Math.round(v[2])];
const jdOf = (iso: string) => jdFromMs(Date.parse(iso));

async function stateNow(def: OuterBodyDef, jd: number): Promise<StateRow | null> {
  const reply = await coveredVectors(def.command, { start: jd, stop: jd + 1 / 24, stepMinutes: 60 }, 'interactive');
  if (!reply.ok) console.warn(`[TAKIP] Horizons ${def.name}: ${reply.error}`);
  return reply.ok ? reply.rows[0] : null;
}

/** A coarse run over 1990–2060 and a fine one through perihelion, where the path turns sharply. */
async function visitorPath(def: (typeof VISITORS)[number]): Promise<StateRow[]> {
  const peri = jdOf(def.perihelion);
  const [far, near] = await Promise.all([
    coveredVectors(def.command, { start: jdOf('1990-01-01'), stop: jdOf('2060-01-01'), stepMinutes: 90 * DAY }, 'interactive'),
    coveredVectors(def.command, { start: peri - 540, stop: peri + 540, stepMinutes: 5 * DAY }, 'interactive'),
  ]);
  const rows = [...(far.ok ? far.rows : []), ...(near.ok ? near.rows : [])].sort((a, b) => a.jd - b.jd);
  return rows.filter((r, i) => i === 0 || r.jd - rows[i - 1].jd > 0.5).map(r => ({ jd: +r.jd.toFixed(3), pos: round(r.pos), vel: [0, 0, 0] }));
}

async function distant(jd: number): Promise<DistantRow[]> {
  const res = await fetch(DISTANT_URL, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`MPC Distant.txt HTTP ${res.status}`);
  const out: DistantRow[] = [];
  for (const line of (await res.text()).split('\n')) {
    const r = parseMpcLine(line);
    const p = r && positionFromElements(r.el, jd);
    if (!r || !p) continue;
    out.push([+(p[0] / AU_KM).toFixed(2), +(p[1] / AU_KM).toFixed(2), +(p[2] / AU_KM).toFixed(2), r.H, +r.el.a.toFixed(1)]);
  }
  return out;
}

export async function collectOuter(now = Date.now()): Promise<OuterPayload> {
  const t0 = Math.floor(now / HOUR_MS) * HOUR_MS;
  const jd = jdFromMs(t0);
  const body = async (def: OuterBodyDef, kind: OuterBody['kind'], path?: Promise<StateRow[]>): Promise<OuterBody | null> => {
    const [s, p] = await Promise.all([stateNow(def, jd), path]);
    return s && { key: def.key, name: def.name, kind, color: def.color, radiusKm: def.radiusKm, helio: round(s.pos), vel: s.vel, ...(p?.length ? { path: p } : {}) };
  };
  const [bodies, rows] = await Promise.all([
    Promise.all([...DWARF_PLANETS.map(d => body(d, 'dwarf')), ...VISITORS.map(v => body(v, 'visitor', visitorPath(v)))]),
    distant(jd).catch(e => { console.warn('[TAKIP] MPC distant objects:', e instanceof Error ? e.message : e); return [] as DistantRow[]; }),
  ]);
  const found = bodies.filter((b): b is OuterBody => b !== null);
  if (!found.length && !rows.length) throw new Error('Horizons and the MPC both failed');
  return { epoch: new Date(t0).toISOString(), bodies: found, distant: rows, distantSource: 'Minor Planet Center, Distant.txt (centaurs and trans-Neptunian objects)' };
}
