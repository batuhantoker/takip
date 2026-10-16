/*
 * Satellites gliding through replay. SGP4 for the whole catalogue costs ~20 ms, too much for every
 * frame, so the worker places every satellite at keyframes a little way apart in replay time and each
 * frame interpolates between the two around the clock.
 */

/** Floats per satellite in a keyframe: the unit vector to its ground point (x, y, z), then altitude in km. */
export const KEY_STRIDE = 4;
/** Floats per satellite in a sample, as the layer takes them: mercator x, y, then altitude in km. */
export const SAMPLE_STRIDE = 3;

/**
 * Keyframes are a minute of replay time apart, or what passes in KEY_WALL_MS when that is more, and
 * never closer than the worker keeps up with: falling behind starts the run over, a visible jump.
 */
const KEY_SIM_MS = 60_000;
const KEY_WALL_MS = 50;
const KEY_HEADROOM = 1.5;
/** Further apart than this (45°) the short way between two keyframes is not the way it went. */
const MIN_DOT = Math.SQRT1_2;

/*
 * An element set places its satellite well only near its own epoch. Run back from today's sets, low
 * orbits were a median 5 km off after 2–5 days and 1 in 10 over 113 km (measured 2026-10-15); after
 * weeks it is anywhere on its orbit, and long ago the satellite didn't exist. Outside this reach it
 * isn't drawn.
 */
const DAY_MS = 86_400_000;
const LOW_ORBIT_MIN = 225;
const LOW_REACH_MS = 7 * DAY_MS;
const HIGH_REACH_MS = 30 * DAY_MS;

/** Whether an element set with this epoch and period can still place its satellite at `t`. */
export const withinReach = (epochMs: number, periodMinutes: number, t: number) =>
  Math.abs(t - epochMs) <= (periodMinutes < LOW_ORBIT_MIN ? LOW_REACH_MS : HIGH_REACH_MS);

/** Where every shown satellite is at `t` (epoch ms); NaN for one with nowhere to be drawn. */
export type SatKey = { t: number; at: Float32Array };

const RAD = Math.PI / 180;

/** Writes one satellite into a keyframe. */
export function writeKey(out: Float32Array, i: number, lng: number, lat: number, altKm: number) {
  const o = i * KEY_STRIDE;
  const c = Math.cos(lat * RAD);
  out[o] = c * Math.cos(lng * RAD);
  out[o + 1] = c * Math.sin(lng * RAD);
  out[o + 2] = Math.sin(lat * RAD);
  out[o + 3] = altKm;
}

/** Replay time between keyframes at this many replay ms per wall ms, when one takes `passMs` to make. */
export const keyGap = (speed: number, passMs = 0) => Math.max(KEY_SIM_MS, speed * Math.max(KEY_WALL_MS, passMs * KEY_HEADROOM));

/**
 * Every satellite at `t`, between keyframes `a` and `b` (or held at `a`). Interpolated on the sphere,
 * so one crossing a pole or the antimeridian goes over it rather than back around the world.
 */
export function sampleKeys(a: SatKey, b: SatKey | null, t: number, out: Float32Array) {
  const n = out.length / SAMPLE_STRIDE;
  const f = b && b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
  const A = a.at;
  const B = b?.at;
  for (let i = 0; i < n; i++) {
    const o = i * KEY_STRIDE;
    const s = i * SAMPLE_STRIDE;
    let x = A[o], y = A[o + 1], z = A[o + 2], alt = A[o + 3];
    if (B && f > 0 && !Number.isNaN(B[o])) {
      if (Number.isNaN(x)) {
        x = B[o]; y = B[o + 1]; z = B[o + 2]; alt = B[o + 3];
      } else if (x * B[o] + y * B[o + 1] + z * B[o + 2] >= MIN_DOT) {
        x += (B[o] - x) * f;
        y += (B[o + 1] - y) * f;
        z += (B[o + 2] - z) * f;
        alt += (B[o + 3] - alt) * f;
      } else if (f >= 0.5) {
        x = B[o]; y = B[o + 1]; z = B[o + 2]; alt = B[o + 3];
      }
    }
    if (Number.isNaN(x)) {
      out[s] = out[s + 1] = out[s + 2] = Number.NaN;
      continue;
    }
    const sinLat = Math.max(-0.9999999, Math.min(0.9999999, z / Math.sqrt(x * x + y * y + z * z)));
    // MapLibre's mercator: x from longitude, y = 0.5 - ln(tan(π/4 + φ/2)) / 2π, and that log is atanh(sin φ).
    out[s] = 0.5 + Math.atan2(y, x) / (2 * Math.PI);
    out[s + 1] = 0.5 - Math.atanh(sinLat) / (2 * Math.PI);
    out[s + 2] = alt;
  }
}

/** Longitude and latitude back from a sample's mercator x, y. */
export const sampleLng = (out: Float32Array, i: number) => out[i * SAMPLE_STRIDE] * 360 - 180;
export const sampleLat = (out: Float32Array, i: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * out[i * SAMPLE_STRIDE + 1]))) / RAD;

/** The keyframes in hand, and which to ask the worker for next. */
export function createKeyframes() {
  let keys: SatKey[] = [];
  return {
    clear() {
      keys = [];
    },
    /**
     * The next instant to propagate, or null when the keyframes in hand cover `t`. Playing, it stays a
     * keyframe or two ahead, and asks `leadMs` of wall time ahead of the clock after a jump so the answer
     * lands about when the clock gets there. `follows` keyframes extend the run; others start a new one.
     */
    next(t: number, playing: boolean, speed: number, leadMs: number): { t: number; follows: boolean } | null {
      const first = keys[0];
      const last = keys[keys.length - 1];
      if (!playing) return first && t >= first.t && t <= last.t ? null : { t, follows: false };
      const gap = keyGap(speed, leadMs);
      const ahead = speed * leadMs;
      if (!last || t < first.t - gap - ahead || t > last.t + gap + ahead) return { t: t + ahead, follows: false };
      return last.t - t < gap + ahead ? { t: last.t + gap, follows: true } : null;
    },
    add(key: SatKey, follows: boolean) {
      if (follows && keys.length && key.t > keys[keys.length - 1].t) keys.push(key);
      else keys = [key];
    },
    /** The keyframes either side of `t`, forgetting the ones it has passed. */
    around(t: number): [SatKey, SatKey | null] | null {
      while (keys.length > 2 && keys[1].t <= t) keys.shift();
      if (!keys.length) return null;
      if (keys.length === 1 || t <= keys[0].t) return [keys[0], null];
      if (t >= keys[1].t) return [keys[1], null];
      return [keys[0], keys[1]];
    },
  };
}
