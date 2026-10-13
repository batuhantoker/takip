/**
 * TAKIP — moving a craft along its orbit between samples. Horizons gives an
 * orbiter's state every day or two, far coarser than an orbit that may last two
 * hours; joining those samples with straight lines scribbles through the
 * planet. Instead each moment is the nearest sample's two-body orbit carried
 * on to it (universal variables, Vallado's formulation), which holds well for
 * the day or so between samples.
 */

import { add, cross, dot, norm, scale } from './astro';
import type { Vec3 } from './horizons';

function stumpff(z: number): [number, number] {
  if (z > 1e-6) {
    const s = Math.sqrt(z);
    return [(1 - Math.cos(s)) / z, (s - Math.sin(s)) / (s * s * s)];
  }
  if (z < -1e-6) {
    const s = Math.sqrt(-z);
    return [(Math.cosh(s) - 1) / -z, (Math.sinh(s) - s) / (s * s * s)];
  }
  return [1 / 2 - z / 24, 1 / 6 - z / 120];
}

/** State `dt` seconds after (r, v) about a body of gravitational parameter `mu` (km³/s²). */
export function propagate(r0: Vec3, v0: Vec3, dt: number, mu: number): { r: Vec3; v: Vec3 } {
  const r0n = norm(r0), v0n = norm(v0);
  const vr0 = dot(r0, v0) / r0n;
  const alpha = 2 / r0n - (v0n * v0n) / mu;
  const sq = Math.sqrt(mu);
  let x = alpha > 1e-9 ? sq * dt * alpha : sq * Math.abs(alpha) * dt;
  if (!Number.isFinite(x) || x === 0) x = sq * dt / r0n;
  for (let k = 0; k < 60; k++) {
    const z = alpha * x * x;
    const [C, S] = stumpff(z);
    const F = (r0n * vr0 / sq) * x * x * C + (1 - alpha * r0n) * x * x * x * S + r0n * x - sq * dt;
    const dF = (r0n * vr0 / sq) * x * (1 - alpha * x * x * S) + (1 - alpha * r0n) * x * x * C + r0n;
    const step = F / dF;
    x -= step;
    if (Math.abs(step) < 1e-9) break;
  }
  const z = alpha * x * x;
  const [C, S] = stumpff(z);
  const f = 1 - (x * x / r0n) * C, g = dt - (x * x * x / sq) * S;
  const r = add(scale(r0, f), scale(v0, g));
  const rn = norm(r);
  const fd = (sq / (rn * r0n)) * (alpha * x * x * x * S - x), gd = 1 - (x * x / rn) * C;
  return { r, v: add(scale(r0, fd), scale(v0, gd)) };
}

/** Orbital period in seconds, or Infinity for an unbound path. */
export function period(r: Vec3, v: Vec3, mu: number): number {
  const energy = dot(v, v) / 2 - mu / norm(r);
  if (energy >= 0) return Infinity;
  const a = -mu / (2 * energy);
  return 2 * Math.PI * Math.sqrt(a * a * a / mu);
}

/** Specific angular momentum's direction, the orbit's pole; zero for radial motion. */
export function orbitPole(r: Vec3, v: Vec3): Vec3 {
  const h = cross(r, v);
  const n = norm(h);
  return n ? scale(h, 1 / n) : [0, 0, 0];
}
