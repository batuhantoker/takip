/**
 * TAKIP — positions at any moment of a spacecraft's replayed flight. The craft
 * comes from the finest Horizons track covering that moment; each planet from
 * planets-approx, gliding onto its exact Horizons track wherever the flight
 * has one (an encounter, or a long stay), so flybys line up to the kilometre.
 * In a long stay the coarse samples are a day or two apart, far longer than an
 * orbit: an orbiter is carried along its two-body orbit between samples. A
 * lander comes in relative to its body and rests on the turning ground
 * (replay-landing); the climb from the pad is drawn (replay-ascent).
 */

import { add, lerp, norm, orbitPath, scale, slerp, sub } from './astro';
import { blendIn, GM, trackAt, trackSample, trackSpan, type CraftHistory, type Phase, type Track } from './flight-history';
import { earthOrientation, iauOrientation, mul, transpose, type Mat3 } from './frames';
import type { Vec3 } from './horizons';
import { approxPosition } from './planets-approx';
import { ascentAt, clearedStart } from './replay-ascent';
import { approachAt, findLanding, LANDED_HOLD_DAYS, type Landing } from './replay-landing';
import { SKY_BODIES, type SkyKey } from './sky';
import { period, propagate } from './two-body';

const ASCENT_SAMPLES = 120;

/**
 * Hill-sphere radii, km: well inside one a craft's path round the body is a
 * two-body orbit; near its edge (Sun–Earth L1 and L2, 1.5 million km out) the
 * Sun shapes the path as much as the body, so the samples are followed instead.
 */
const HILL_KM: Partial<Record<SkyKey, number>> = {
  mercury: 1.75e5, venus: 1.0e6, earth: 1.5e6, moon: 6.0e4, mars: 1.08e6,
  jupiter: 5.3e7, saturn: 6.5e7, uranus: 7.0e7, neptune: 1.16e8, pluto: 6.0e6,
};

const HALO_DAYS = 180;
/** Joining samples with lines needs this many per orbit; fewer, and the orbit is flown instead. */
const SAMPLES_PER_ORBIT = 12;
/** The approach line fades over this long after touchdown, as the ground turns away from its end. */
const APPROACH_FADE_DAYS = 0.04;

export interface ReplayTrace {
  key: string;
  body: SkyKey;
  center: Vec3;
  angle: number;
  current: Vec3;
  jd: Float64Array;
  pos: Float32Array;
  periodDays: number;
  /** Opacity, 0–1. */
  fade: number;
}
export const RADIUS_KM = Object.fromEntries(SKY_BODIES.map(b => [b.key, b.radiusKm])) as Record<SkyKey, number>;

interface Exact { body: SkyKey; track: Track; t0: number; t1: number; ramp: number }


/** Long stays glide onto their exact track over at most this many days. */
const STAY_RAMP_DAYS = 10;

export class ReplayModel {
  readonly history: CraftHistory;
  /** Where and when a lander touched down, with its approach relative to the body. */
  readonly landing: Landing | null;
  /** Craft tracks, widest first, so the last one covering a moment is the finest. */
  private readonly fine: Track[];
  private readonly exact: Exact[];

  /** Long stays with the craft's track relative to the body. */
  private readonly stays: Phase[];
  private readonly fixed = new Map<Phase, Vec3>();
  private readonly traces = new Map<Phase, { jd: Float64Array; pos: Float32Array; rotating: boolean }>();

  constructor(history: CraftHistory) {
    const site = history.phases.find(p => p.landed)?.body;
    const landing = site ? findLanding(history, HILL_KM[site] ?? Infinity, RADIUS_KM[site], jd => this.orientation(site, jd)) : null;
    this.landing = landing;
    // A lander's flight ends on the ground: a sol there, not the years of its surface ephemeris.
    const end = landing ? Math.min(history.end, landing.jd + LANDED_HOLD_DAYS) : history.end;
    const start = clearedStart(history);
    this.history = end < history.end || start > history.start ? { ...history, start, end, events: history.events.filter(e => e.jd <= end + 1e-9) } : history;
    this.stays = history.phases.filter(p => p.rel);
    this.fine = history.encounters.flatMap(e => e.craft).sort((a, b) => b.step - a.step);
    const exact: Exact[] = [];
    for (const e of history.encounters) {
      e.bodyTrack.forEach(track => {
        const [t0, t1] = trackSpan(track);
        exact.push({ body: e.body, track, t0, t1, ramp: (t1 - t0) * 0.2 });
      });
    }
    for (const p of history.phases) {
      if (p.bodyTrack) exact.push({ body: p.body, track: p.bodyTrack, t0: p.t0, t1: p.t1, ramp: Math.min(STAY_RAMP_DAYS, (p.t1 - p.t0) * 0.2) });
    }
    this.exact = exact.sort((a, b) => b.track.step - a.track.step);
  }

  /** The flight begins on the pad when the launch is known, else where Horizons' track begins. */
  get start() { return this.history.launch?.jd ?? this.history.start; }
  get end() { return this.history.end; }

  clamp(jd: number): number {
    return Math.min(this.end, Math.max(this.start, jd));
  }

  /** The finest track covering `jd`, or the coarse one. */
  private craftTrack(jd: number): Track {
    for (let i = this.fine.length - 1; i >= 0; i--) {
      const [a, b] = trackSpan(this.fine[i]);
      if (jd >= a && jd <= b) return this.fine[i];
    }
    return this.history.coarse;
  }

  craftAt(jd: number): Vec3 {
    const t = this.clamp(jd);
    if (this.ascending(t)) return this.ascentAt(t);
    const l = this.landing;
    if (l && t >= l.from) return add(this.bodyAt(l.body, t), this.landerRel(l, t));
    const track = this.craftTrack(t);
    const stay = this.stayFor(t, track);
    const p = stay && this.inStay(stay, t);
    return p || (trackAt(track, t) ?? trackAt(this.history.coarse, t)!);
  }

  /** A lander relative to its body: on its approach, then on the spot it came to rest on. */
  private landerRel(l: Landing, t: number): Vec3 {
    const R = t >= l.jd ? this.orientation(l.body, t) : null;
    return R ? mul(R, l.fixed) : approachAt(l, t);
  }

  /** Whether the craft is on the ground at `jd`. */
  landed(jd: number): boolean {
    return !!this.landing && this.clamp(jd) >= this.landing.jd;
  }

  /**
   * The stay that places the craft at `t` instead of `track`: any stay over the
   * coarse track, and an orbit the track samples too sparsely to join with lines
   * (an arrival's widest stretch is hours apart; a low orbit lasts two).
   */
  private stayFor(t: number, track: Track): Phase | null {
    const p = this.stayAt(t);
    if (!p || track === this.history.coarse) return p;
    if (p.landed) return null;
    // Only between two samples already in orbit: across an insertion burn the fine track carries the craft through it.
    const T = Math.max(...this.bracket(p, t).map(k => this.orbitSeconds(p, k)));
    return track.step * 86_400 * SAMPLES_PER_ORBIT > T ? p : null;
  }

  /** The stay's samples either side of `t`. */
  private bracket(p: Phase, t: number): [number, number] {
    const rel = p.rel!, n = rel.pos.length / 3;
    const i = Math.min(Math.max(0, n - 2), Math.max(0, Math.floor((t - rel.t0) / rel.step)));
    return [i, Math.min(n - 1, i + 1)];
  }

  /** The period of sample `k`'s orbit, s; Infinity when it is not bound, or too far out to be a two-body orbit. */
  private orbitSeconds(p: Phase, k: number): number {
    const rel = p.rel!, r = trackSample(rel, k);
    return this.keplerian(p, r) ? period(r, [rel.vel[k * 3], rel.vel[k * 3 + 1], rel.vel[k * 3 + 2]], GM[p.body] ?? 1) : Infinity;
  }

  /** Between lift-off and Horizons' first point: the part of the flight that is drawn, not measured. */
  ascending(jd: number): boolean {
    const l = this.history.launch;
    return !!l && jd >= l.jd && jd < this.history.start;
  }

  private ascentAt(t: number): Vec3 {
    return ascentAt(this.history.launch!, this.history.start, t, this.bodyAt('earth', t), this.ascentEnd ??= this.firstState());
  }

  private ascentEnd: { r: Vec3; v: Vec3 } | null = null;

  /** Horizons' first state relative to Earth, from the finest launch stretch. */
  private firstState(): { r: Vec3; v: Vec3 } {
    const t0 = this.history.start;
    const track = this.craftTrack(t0);
    const h = track.step;
    const p0 = trackAt(track, t0) ?? trackAt(this.history.coarse, t0)!;
    const p1 = trackAt(track, t0 + h) ?? p0;
    const e0 = this.bodyAt('earth', t0), e1 = this.bodyAt('earth', t0 + h);
    return { r: sub(p0, e0), v: scale(sub(sub(p1, e1), sub(p0, e0)), 1 / (h * 86_400)) };
  }

  /** Body-fixed to scene, for the bodies a replay can say: Earth's own formula, the IAU model for Mars and the Moon. */
  orientation(key: SkyKey, jd: number): Mat3 | null {
    if (key === 'earth') return earthOrientation(jd);
    return key === 'mars' || key === 'moon' ? iauOrientation(key, jd) : null;
  }

  /** The stay covering `t`; where two do (near the Moon is also near Earth), the body the craft is closer to. */
  private stayAt(t: number): Phase | null {
    let best: Phase | null = null, bestKm = Infinity;
    for (const p of this.stays) {
      // A landing places its craft itself, from its approach to the ground.
      if (t <= p.t0 || t > p.t1 || (p.landed && this.landing)) continue;
      const km = norm(this.nearest(p, t).r);
      if (km < bestKm) { best = p; bestKm = km; }
    }
    return best;
  }


  /** Heliocentric longitude of a body, radians: the Sun–body line a craft at L1 or L2 keeps its place on. */
  private sunLine(key: SkyKey, jd: number): number {
    const b = this.bodyAt(key, jd);
    return Math.atan2(b[1], b[0]);
  }

  /**
   * A stay's track drawn round its body, for the stay the craft is in at `jd`:
   * an orbiter's orbits in the body's own frame, a craft at L1 or L2 turned with
   * the Sun–body line so its halo orbit is a loop rather than a year-long arc.
   * Null on the ground, between stays, or in an orbit too tight for its samples
   * (that one is drawn as its current ellipse instead).
   */
  traceAt(jd: number): ReplayTrace | null {
    const t = this.clamp(jd);
    const l = this.landing;
    if (l && t >= l.from) {
      this.approachPos ??= Float32Array.from(l.rel);
      const n = l.times.length;
      return {
        key: `landing:${l.jd}`, body: l.body, center: this.bodyAt(l.body, t), angle: 0,
        current: t < l.jd ? approachAt(l, t) : [l.rel[(n - 1) * 3], l.rel[(n - 1) * 3 + 1], l.rel[(n - 1) * 3 + 2]],
        // Not an orbit: the whole approach is drawn, flown and ahead.
        jd: l.times, pos: this.approachPos, periodDays: Infinity,
        fade: t < l.jd ? 1 : Math.max(0, 1 - (t - l.jd) / APPROACH_FADE_DAYS),
      };
    }
    const p = this.stayAt(t);
    if (!p || p.landed) return null;
    const s = this.nearest(p, t);
    // An orbit is drawn as its current ellipse (orbitAt): samples a day or two apart only cut chords across it.
    if (this.keplerian(p, s.r)) return null;
    let trace = this.traces.get(p);
    if (!trace) {
      const rel = p.rel!, n = rel.pos.length / 3, rotating = true;
      const times = new Float64Array(n), pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const ti = rel.t0 + i * rel.step, r = trackSample(rel, i);
        const a = rotating ? -this.sunLine(p.body, ti) : 0;
        times[i] = ti;
        pos.set([r[0] * Math.cos(a) - r[1] * Math.sin(a), r[0] * Math.sin(a) + r[1] * Math.cos(a), r[2]], i * 3);
      }
      trace = { jd: times, pos, rotating };
      this.traces.set(p, trace);
    }
    const center = this.bodyAt(p.body, t);
    const angle = trace.rotating ? this.sunLine(p.body, t) : 0;
    const r = sub(this.craftAt(t), center);
    const current: Vec3 = [r[0] * Math.cos(-angle) - r[1] * Math.sin(-angle), r[0] * Math.sin(-angle) + r[1] * Math.cos(-angle), r[2]];
    // A halo orbit at L1 or L2 takes about six months.
    return { key: String(p.t0), body: p.body, center, angle, current, jd: trace.jd, pos: trace.pos, periodDays: HALO_DAYS, fade: 1 };
  }

  private approachPos: Float32Array | null = null;

  /** Whether the craft is deep enough in the body's gravity for its path to be a two-body orbit. */
  private keplerian(p: Phase, r: Vec3): boolean {
    return norm(r) < 0.5 * (HILL_KM[p.body] ?? Infinity);
  }

  /** The nearest coarse sample's state relative to the stay's body. */
  private nearest(p: Phase, t: number): { i: number; t: number; r: Vec3; v: Vec3 } {
    const rel = p.rel!;
    const n = rel.pos.length / 3;
    const i = Math.min(n - 1, Math.max(0, Math.round((t - rel.t0) / rel.step)));
    return { i, t: rel.t0 + i * rel.step, r: trackSample(rel, i), v: [rel.vel[i * 3], rel.vel[i * 3 + 1], rel.vel[i * 3 + 2]] };
  }

  private inStay(p: Phase, t: number): Vec3 | null {
    const body = this.bodyAt(p.body, t);
    if (p.landed) {
      const R = this.orientation(p.body, t);
      const fixed = this.surfacePoint(p);
      return R && fixed ? add(body, mul(R, fixed)) : null;
    }
    const s = this.nearest(p, t);
    if (!this.keplerian(p, s.r)) return add(body, trackAt(p.rel!, t) ?? s.r);
    const rel = p.rel!, gm = GM[p.body] ?? 1;
    const state = (k: number) => propagate(trackSample(rel, k), [rel.vel[k * 3], rel.vel[k * 3 + 1], rel.vel[k * 3 + 2]], (t - rel.t0 - k * rel.step) * 86_400, gm).r;
    const [i, j] = this.bracket(p, t);
    // Across a capture one side is not yet in orbit and a blend would invent an arc: the nearer sample alone.
    if (i === j || !Number.isFinite(this.orbitSeconds(p, i)) || !Number.isFinite(this.orbitSeconds(p, j))) return add(body, state(s.i));
    // Carried on from the sample before and back from the one after, eased between: no jump where they hand over.
    const w = Math.min(1, Math.max(0, (t - rel.t0) / rel.step - i));
    return add(body, slerp(state(i), state(j), w * w * (3 - 2 * w)));
  }

  /** Where a lander sits, body-fixed: from its last sample, turned back by the body's rotation then. */
  private surfacePoint(p: Phase): Vec3 | null {
    if (this.fixed.has(p)) return this.fixed.get(p)!;
    const rel = p.rel!;
    const last = rel.pos.length / 3 - 1;
    const R = this.orientation(p.body, rel.t0 + last * rel.step);
    if (!R) return null;
    const v = mul(transpose(R), trackSample(rel, last));
    this.fixed.set(p, v);
    return v;
  }

  /**
   * Whether the craft is on a body or in a tight orbit round it at `jd`, outside
   * any fine stretch: its coarse samples are then orbits apart and are not drawn.
   */
  staying(jd: number): boolean {
    const t = this.clamp(jd);
    if (this.landing && t >= this.landing.from) return true;
    return this.stayFor(t, this.craftTrack(t)) !== null;
  }

  /** The orbit a stay is on at `jd`, relative to its body, for drawing; null when landed or between stays. */
  orbitAt(jd: number): { body: SkyKey; key: string; points: Vec3[] } | null {
    const t = this.clamp(jd);
    if (this.landing && t >= this.landing.from) return null;
    const p = this.stayFor(t, this.craftTrack(t));
    if (!p || p.landed) return null;
    const s = this.nearest(p, t);
    if (!this.keplerian(p, s.r)) return null;
    const points = orbitPath(s.r, s.v, GM[p.body], 180);
    return points ? { body: p.body, key: `${p.t0}:${s.i}`, points } : null;
  }

  /** Heliocentric speed, km/s, from the track's own spacing; along an orbit, over a minute. */
  speedAt(jd: number): number {
    const t = this.clamp(jd);
    const track = this.craftTrack(t);
    const h = this.ascending(t) || this.staying(t) ? 1 / 1440 : track.step / 2;
    const a = this.craftAt(t - h), b = this.craftAt(t + h);
    const dt = (Math.min(this.end, t + h) - Math.max(this.start, t - h)) * 86_400;
    return dt > 0 ? norm(sub(b, a)) / dt : 0;
  }

  bodyAt(key: SkyKey, jd: number): Vec3 {
    // Before Horizons' first point, a body with an exact launch track runs straight back along it: an hour of orbit is a line.
    if (this.ascending(jd)) {
      const e = this.exact.find(x => x.body === key && x.t0 <= this.history.start + 1e-6);
      if (e && e.track.pos.length >= 6) {
        const a = trackSample(e.track, 0), b = trackSample(e.track, 1);
        return lerp(a, b, (jd - e.track.t0) / e.track.step);
      }
    }
    let p = approxPosition(key, jd);
    for (const e of this.exact) {
      // Track edges are rounded to the microday; a hair outside is still on them.
      if (e.body !== key || jd < e.t0 - 1e-6 || jd > e.t1 + 1e-6) continue;
      const exact = trackAt(e.track, jd);
      if (!exact) continue;
      // A stay that starts at launch or runs to the end has nothing to glide from there.
      const t0 = e.t0 <= this.history.start + 1e-6 ? e.t0 - e.ramp : e.t0, t1 = e.t1 >= this.end - 1e-6 ? e.t1 + e.ramp : e.t1;
      p = lerp(p, exact, blendIn(t0, t1, jd, e.ramp / (t1 - t0)));
    }
    return p;
  }

  /** The tightest fine stretch covering `jd`, in days, or null in cruise: playback slows to it. */
  stretchAt(jd: number): number | null {
    if (this.ascending(jd)) return this.history.start - this.history.launch!.jd;
    const t = this.craftTrack(jd);
    if (t === this.history.coarse) return null;
    const [a, b] = trackSpan(t);
    return b - a;
  }

  /** Every sample to draw the path through, the finest available at each moment, in time order. */
  path(): { jd: Float64Array; pos: Float64Array } {
    const out: { jd: number; p: Vec3 }[] = [];
    const tracks = [this.history.coarse, ...this.fine];
    tracks.forEach(track => {
      const n = track.pos.length / 3;
      for (let i = 0; i < n; i++) {
        const jd = track.t0 + i * track.step;
        if (jd < this.history.start || this.craftTrack(jd) !== track) continue;
        // A stay is drawn round its body (traceAt), or as its current orbit; in the Sun's frame its samples only scribble.
        if (this.staying(jd)) continue;
        out.push({ jd, p: [track.pos[i * 3], track.pos[i * 3 + 1], track.pos[i * 3 + 2]] });
      }
    });
    // A landing's approach is drawn round its body from here; the path in the Sun's frame ends on the craft as it hands over.
    if (this.landing) out.push({ jd: this.landing.from, p: this.craftAt(this.landing.from) });
    const l = this.history.launch;
    if (l) for (let i = 0; i < ASCENT_SAMPLES; i++) {
      const jd = l.jd + (i / ASCENT_SAMPLES) * (this.history.start - l.jd);
      out.push({ jd, p: this.ascentAt(jd) });
    }
    out.sort((a, b) => a.jd - b.jd);
    return { jd: Float64Array.from(out, s => s.jd), pos: Float64Array.from(out.flatMap(s => s.p)) };
  }
}
