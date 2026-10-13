import { DEG, orbitAt, type OrbitShape } from './globe-geometry';
import type { Disc } from './globe-scene';

/* Same lean and openness as the mark's orbit (an ellipse 236 × 84 at −20°). */
const ORBIT: OrbitShape = { radius: 1.42, tilt: 20 * DEG, open: 0.34 };
const LAUNCH = 0.45;
const LAP = 3.4;
const TRAIL = 1.6;
const TRAIL_STEPS = 36;
const RING_STEPS = 150;
const TAU = Math.PI * 2;

export interface Satellite {
  /** Where the satellite is on the orbit, in radians. */
  a: number;
  /** How much of the ring it has laid down behind it. */
  drawn: number;
}

/** It launches from the left and draws the ring in on its first lap, as the mark's orbit does. */
export function satelliteAngle(t: number, still: boolean): Satellite | null {
  if (still) return { a: TAU - 0.3, drawn: TAU };
  if (t < LAUNCH) return null;
  const travelled = ((t - LAUNCH) * TAU) / LAP;
  return { a: Math.PI + travelled, drawn: Math.min(TAU, travelled) };
}

/** One depth layer: the back pass goes under the opaque globe, the front pass over it. */
export function drawOrbit(ctx: CanvasRenderingContext2D, { cx, cy, r }: Disc, sat: Satellite | null, layer: 'back' | 'front') {
  if (!sat) return;
  const front = layer === 'front';
  const s = r / 200;
  const at = (a: number) => {
    const [x, y, z] = orbitAt(a, ORBIT);
    return [cx + x * r, cy + y * r, z] as const;
  };
  const from = sat.a - sat.drawn;

  // Ring samples sit at fixed angles so the dotted back half doesn't crawl.
  const step = TAU / RING_STEPS;
  ctx.beginPath();
  let pen = false;
  for (let k = Math.ceil(from / step); k * step <= sat.a; k++) {
    const [x, y, z] = at(k * step);
    if (front && z >= 0) {
      if (pen) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
      pen = true;
    } else {
      pen = false;
      if (!front && z < 0 && k % 2 === 0) {
        ctx.moveTo(x + 1.1 * s, y);
        ctx.arc(x, y, 1.1 * s, 0, TAU);
      }
    }
  }
  if (front) {
    ctx.strokeStyle = 'rgba(47,128,255,0.38)';
    ctx.lineWidth = 1.2 * s;
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(47,128,255,0.55)';
    ctx.fill();
  }

  const tail = Math.max(sat.a - TRAIL, from);
  ctx.lineCap = 'round';
  for (let j = 0; j < TRAIL_STEPS; j++) {
    const a1 = tail + ((sat.a - tail) * j) / TRAIL_STEPS;
    const a2 = tail + ((sat.a - tail) * (j + 1)) / TRAIL_STEPS;
    const [x1, y1, z1] = at(a1);
    const [x2, y2, z2] = at(a2);
    if ((z1 + z2 >= 0) !== front) continue;
    const f = 1 - (sat.a - a2) / TRAIL;
    const lift = Math.max(0, f - 0.8) * 5;
    ctx.strokeStyle = `rgba(${Math.round(47 + 160 * lift)},${Math.round(128 + 100 * lift)},255,${(f ** 1.6 * (front ? 1 : 0.6)).toFixed(3)})`;
    ctx.lineWidth = (0.8 + 2.4 * f) * s;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  const [hx, hy, hz] = at(sat.a);
  if ((hz >= 0) !== front) return;
  const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 14 * s);
  glow.addColorStop(0, 'rgba(120,175,255,0.55)');
  glow.addColorStop(1, 'rgba(47,128,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(hx, hy, 14 * s, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#F2F5FA';
  ctx.beginPath();
  ctx.arc(hx, hy, 2.8 * s, 0, TAU);
  ctx.fill();
}
