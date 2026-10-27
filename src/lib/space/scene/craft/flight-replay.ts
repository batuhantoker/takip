import * as THREE from 'three';
import { msFromJd } from '@/lib/space/horizons';
import { RATES } from '@/lib/space/replay/format';
import type { ReplayModel } from '@/lib/space/replay/model';
import { rateCap } from '@/lib/space/replay/pacing';
import { AbsolutePositions } from '../floating-origin';
import { dotTexture } from '../shared';

/**
 * A spacecraft's flight played back: its whole path (the part flown so far
 * bright, the rest faint, JPL's prediction past today in another colour) and
 * the clock that moves along it. Playback slows by itself through every
 * encounter so a flyby that takes hours does not flash by at years a second.
 */

export interface ReplayState {
  craftId: number;
  jd: number;
  playing: boolean;
  /** Days of flight per second of playback, as chosen. */
  rate: number;
  /** What it is actually running at, slowed through an encounter. */
  effectiveRate: number;
  follow: boolean;
}

const FLOWN = '#F0D060';
const AHEAD = '#F0D060';
const PREDICTED = '#7FDBFF';
/** Orbits of a stay's track drawn behind the craft. */
const TRACE_ORBITS_BEHIND = 3;

/** A playback rate that covers the whole flight in about a minute, rounded to a readable step. */
export function defaultRate(spanDays: number): number {
  return (RATES.find(r => r.days >= spanDays / 60) ?? RATES[RATES.length - 1]).days;
}

function line(geometry: THREE.BufferGeometry, color: string, opacity: number, order: number): THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> {
  const l = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
  l.frustumCulled = false;
  l.renderOrder = order;
  return l;
}

export function createFlightReplay(model: ReplayModel, craftId: number) {
  const { jd: times, pos } = model.path();
  const n = times.length;
  // The path in the Sun's frame, drawn about the floating origin; orbit and trace sit on their bodies instead.
  const path = new THREE.Group();
  // One position buffer, three draw ranges: a draw range belongs to a geometry, so each line gets its own.
  const samples = new AbsolutePositions(path, pos);
  const geometry = () => new THREE.BufferGeometry().setAttribute('position', samples.attribute);
  const predictedFrom = Math.max(0, times.findIndex(t => t > model.history.fetchedJd));
  const hasPrediction = model.history.end > model.history.fetchedJd && predictedFrom > 0;

  const ahead = line(geometry(), AHEAD, 0.22, 1);
  const predicted = line(geometry(), PREDICTED, 0.35, 1);
  const flown = line(geometry(), FLOWN, 0.95, 2);
  const headKm = new AbsolutePositions(path, 2);
  const head = line(new THREE.BufferGeometry().setAttribute('position', headKm.attribute), FLOWN, 0.95, 2);
  ahead.geometry.setDrawRange(0, hasPrediction ? predictedFrom + 1 : n);
  predicted.geometry.setDrawRange(predictedFrom, hasPrediction ? n - predictedFrom : 0);
  // The craft itself: a past mission is in no fleet to draw its dot, and most have no model.
  const markerKm = new AbsolutePositions(path, 1);
  const marker = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', markerKm.attribute), new THREE.PointsMaterial({ color: FLOWN, size: 8, sizeAttenuation: false, map: dotTexture(), transparent: true, depthWrite: false }));
  marker.frustumCulled = false;
  marker.renderOrder = 3;
  path.add(ahead, predicted, flown, head, marker);
  const group = new THREE.Group();
  group.add(path);
  // The orbit a craft is on while it stays with a body, drawn round that body and carried with it.
  const orbit = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: FLOWN, transparent: true, opacity: 0.55, depthWrite: false }));
  orbit.frustumCulled = false;
  orbit.visible = false;
  group.add(orbit);
  let orbitKey = '';

  // A stay's own track, drawn round its body: the part flown bright, the rest faint, with a head to the craft.
  const trace = new THREE.Group();
  const traceAhead = line(new THREE.BufferGeometry(), AHEAD, 0.25, 1);
  const traceFlown = line(new THREE.BufferGeometry(), FLOWN, 0.85, 2);
  const traceHead = line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)), FLOWN, 0.85, 2);
  trace.add(traceAhead, traceFlown, traceHead);
  trace.visible = false;
  group.add(trace);
  let traceKey = '';
  let traceTimes: Float64Array = new Float64Array(0);
  let tracePos: Float32Array = new Float32Array(0);

  const state: ReplayState = { craftId, jd: model.start, playing: false, rate: defaultRate(model.end - model.start), effectiveRate: 0, follow: false };
  let lastTick = 0;

  /** Advances the clock by the wall time since the last frame and redraws the flown part. */
  function tick(now: number) {
    const dt = lastTick ? Math.min(0.1, (now - lastTick) / 1000) : 0;
    lastTick = now;
    const cap = rateCap(model, state.jd);
    state.effectiveRate = cap === null ? state.rate : Math.min(state.rate, cap);
    if (state.playing) {
      state.jd = Math.min(model.end, state.jd + dt * state.effectiveRate);
      if (state.jd >= model.end) state.playing = false;
    }
    // Last sample at or before now: a binary search, the path runs to thousands of samples.
    let lo = 0, hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (times[mid] <= state.jd) lo = mid; else hi = mid - 1;
    }
    flown.geometry.setDrawRange(0, lo + 1);
    const tr = model.traceAt(state.jd);
    trace.visible = !!tr;
    if (tr) {
      if (tr.key !== traceKey) {
        traceKey = tr.key;
        traceTimes = tr.jd;
        tracePos = tr.pos;
        const samples = new THREE.BufferAttribute(tracePos, 3);
        traceAhead.geometry.dispose();
        traceFlown.geometry.dispose();
        traceAhead.geometry = new THREE.BufferGeometry().setAttribute('position', samples);
        traceFlown.geometry = new THREE.BufferGeometry().setAttribute('position', samples);
      }
      trace.position.set(...tr.center);
      trace.rotation.set(0, 0, tr.angle);
      traceAhead.material.opacity = 0.25 * tr.fade;
      traceFlown.material.opacity = traceHead.material.opacity = 0.85 * tr.fade;
      trace.visible = tr.fade > 0.01;
      let a = 0, b = traceTimes.length - 1;
      while (a < b) {
        const m = (a + b + 1) >> 1;
        if (traceTimes[m] <= state.jd) a = m; else b = m - 1;
      }
      // Years of orbits drawn at once are a tangle: the last few flown, and the one ahead.
      const perOrbit = Math.max(2, Math.ceil(tr.periodDays / Math.max(1e-6, traceTimes[1] - traceTimes[0])));
      const from = Math.max(0, a - TRACE_ORBITS_BEHIND * perOrbit);
      traceFlown.geometry.setDrawRange(from, a + 1 - from);
      traceAhead.geometry.setDrawRange(a, Math.min(traceTimes.length - a, perOrbit + 1));
      const h = traceHead.geometry.getAttribute('position') as THREE.BufferAttribute;
      h.setXYZ(0, tracePos[a * 3], tracePos[a * 3 + 1], tracePos[a * 3 + 2]);
      h.setXYZ(1, ...tr.current);
      h.needsUpdate = true;
    }
    const o = model.orbitAt(state.jd);
    orbit.visible = !!o;
    if (o) {
      if (o.key !== orbitKey) {
        orbitKey = o.key;
        orbit.geometry.dispose();
        orbit.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(o.points.flat()), 3));
      }
      orbit.position.set(...model.bodyAt(o.body, state.jd));
    }
    const p = model.craftAt(state.jd);
    // In a long stay the last drawn sample is the arrival, years and orbits away: no line to it.
    head.visible = !model.staying(state.jd);
    headKm.setXYZ(0, pos[lo * 3], pos[lo * 3 + 1], pos[lo * 3 + 2]);
    headKm.setXYZ(1, p[0], p[1], p[2]);
    markerKm.setXYZ(0, p[0], p[1], p[2]);
  }

  return {
    model, group, state,
    tick,
    rebase(origin: THREE.Vector3) {
      samples.rebase(origin);
      headKm.rebase(origin);
      markerKm.rebase(origin);
    },
    ms: () => msFromJd(state.jd),
    play() {
      if (state.jd >= model.end) state.jd = model.start;
      state.playing = true;
    },
    pause() { state.playing = false; },
    seek(jd: number) { state.jd = model.clamp(jd); },
    setRate(r: number) { state.rate = r; },
    setFollow(f: boolean) { state.follow = f; },
    dispose() {
      group.traverse(o => {
        const l = o as THREE.Line;
        l.geometry?.dispose();
        (l.material as THREE.Material | undefined)?.dispose();
      });
    },
  };
}

export type FlightReplay = ReturnType<typeof createFlightReplay>;
