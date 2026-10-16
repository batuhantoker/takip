import { toVec } from './plates';
import type { Pin, PlateModel } from './reconstruct';

/* How a pinned place moves with its plate: its heading and speed at an age, and the path it took to get there. */

const RAD = Math.PI / 180;
const EARTH_KM = 6371;
/** Motion is read over the million years before the age. */
const STEP_MA = 1;

export type Motion = { at: [number, number]; bearing: number; cmPerYear: number };

function angle(a: [number, number], b: [number, number]) {
  const [ax, ay, az] = toVec(a[0], a[1]);
  const [bx, by, bz] = toVec(b[0], b[1]);
  return Math.atan2(Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx), ax * bx + ay * by + az * bz);
}

/** Compass bearing at `b` of the great circle arriving there from `a`. */
function heading(a: [number, number], b: [number, number]) {
  const [lon1, lat1, lon2, lat2] = [b[0] * RAD, b[1] * RAD, a[0] * RAD, a[1] * RAD];
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  // The bearing back toward `a`, turned round.
  return ((Math.atan2(y, x) / RAD + 180) % 360 + 360) % 360;
}

/** Where the place is at `ma`, which way it is heading and how fast, in cm a year (km per Myr ÷ 10). */
export function motionAt(model: PlateModel, pin: Pin, ma: number): Motion | null {
  const at = model.where(pin, ma);
  if (!at) return null;
  // Read over the million years before; when the ground is younger than that, over the one after.
  const before = model.where(pin, ma + STEP_MA);
  const after = before ? null : ma >= STEP_MA ? model.where(pin, ma - STEP_MA) : null;
  const from = before ?? at;
  const to = before ? at : after ?? at;
  const km = angle(from, to) * EARTH_KM;
  return { at, bearing: km > 0 ? heading(from, to) : 0, cmPerYear: km / STEP_MA / 10 };
}

/** The path to `ma` over the `span` million years before it, oldest first, longitudes run on past ±180. */
export function trailTo(model: PlateModel, pin: Pin, ma: number, span: number, step: number): [number, number][] {
  const out: [number, number][] = [];
  for (let back = span; back >= 0; back -= step) {
    const p = model.where(pin, ma + back);
    if (!p) continue;
    const prev = out[out.length - 1];
    const lon = prev ? prev[0] + (((p[0] - prev[0] + 540) % 360) - 180) : p[0];
    out.push([lon, p[1]]);
  }
  return out;
}
