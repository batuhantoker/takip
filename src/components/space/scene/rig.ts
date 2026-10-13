import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * The space camera: orbits whatever it is anchored to and moves with it, since
 * everything here is moving. A change of anchor is a flight whose distance is
 * eased in log space, so leaving Earth for the whole solar system reads as one
 * pull-back rather than a jump.
 */

export interface AnchorState { position: THREE.Vector3; radius: number }

const FLY_MS = 2200;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createRig(camera: THREE.PerspectiveCamera, dom: HTMLElement) {
  const controls = new OrbitControls(camera, dom);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.5;
  controls.zoomSpeed = 1.4;
  // Panning would leave the anchor; the anchor is how the view is chosen.
  controls.enablePan = false;
  // Out past the edge of the observable universe; the logarithmic depth buffer spans the range.
  controls.maxDistance = 2e24;

  let anchor: () => AnchorState | null = () => null;
  const last = new THREE.Vector3();
  let hasLast = false;
  let flight: { t0: number; ms: number; fromTarget: THREE.Vector3; fromDir: THREE.Vector3; fromDist: number; toDir: THREE.Vector3; toDist: number } | null = null;
  let swing: { t0: number; ms: number; from: THREE.Vector3 } | null = null;
  let push: { t0: number; ms: number; factor: number; done: number } | null = null;

  /** Re-anchors and flies there; `direction` is where the camera ends up, seen from the anchor. */
  function setAnchor(next: () => AnchorState | null, distance: number, direction?: THREE.Vector3, instant = false, ms = FLY_MS) {
    anchor = next;
    swing = null;
    push = null;
    const a = next();
    if (!a) return;
    const offset = camera.position.clone().sub(controls.target);
    const fromDist = Math.max(offset.length(), 1);
    const toDir = (direction ?? offset).clone().normalize();
    // A fresh camera has no offset to keep; without a direction it would land on the anchor.
    if (toDir.lengthSq() === 0) toDir.set(0, -1, 0.3).normalize();
    if (instant || !hasLast) {
      controls.target.copy(a.position);
      camera.position.copy(a.position).addScaledVector(toDir, distance);
      flight = null;
    } else {
      flight = { t0: performance.now(), ms, fromTarget: controls.target.clone(), fromDir: offset.normalize(), fromDist, toDir, toDist: distance };
    }
    last.copy(a.position);
    hasLast = true;
  }

  /**
   * Hands the pivot to a new anchor without moving the camera: the view swings
   * round to it over `ms` while the wheel keeps working, so zooming never stalls.
   */
  function retarget(next: () => AnchorState | null, ms: number) {
    const a = next();
    if (!a) return;
    anchor = next;
    flight = null;
    swing = { t0: performance.now(), ms, from: controls.target.clone() };
    last.copy(a.position);
    hasLast = true;
  }

  // The wheel is the rig's own (OrbitControls keeps pinch): log-scale and eased, and faster the longer it is
  // held, so the twenty orders of magnitude from the map to the universe are seconds of scrolling, not minutes.
  let pendingLog = 0, streakFrom = 0, lastWheel = 0, lastSign = 0, lastFrame = 0;

  function wheel(e: WheelEvent) {
    const px = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * 800 : e.deltaY;
    if (!px) return;
    const now = performance.now();
    if (now - lastWheel > 220 || Math.sign(px) !== lastSign) streakFrom = now;
    lastWheel = now;
    lastSign = Math.sign(px);
    const accel = 1 + 3 * Math.min(1, (now - streakFrom) / 2500);
    pendingLog += px * (e.ctrlKey ? 0.012 : 0.0025) * accel;
    // Scrolling during a flight takes the camera back: the flight becomes a swing of the view onto its anchor.
    if (flight) {
      flight = null;
      swing = { t0: now, ms: 600, from: controls.target.clone() };
    }
  }

  function applyZoom() {
    const now = performance.now();
    const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0.016;
    lastFrame = now;
    if (Math.abs(pendingLog) < 1e-5) { pendingLog = 0; return; }
    const step = pendingLog * Math.min(1, dt * 14);
    pendingLog -= step;
    const offset = camera.position.clone().sub(controls.target);
    const d = offset.length();
    const next = Math.min(controls.maxDistance, Math.max(controls.minDistance, d * Math.exp(step)));
    camera.position.copy(controls.target).addScaledVector(offset, next / d);
    if (next === controls.minDistance || next === controls.maxDistance) pendingLog = 0;
  }

  /** Scales the camera's distance at once, keeping its direction: a following replay camera tracking the scene's scale. */
  function scaleDistance(k: number) {
    if (flight || !Number.isFinite(k) || k <= 0) return;
    const offset = camera.position.clone().sub(controls.target);
    const d = offset.length();
    const next = Math.min(controls.maxDistance, Math.max(controls.minDistance, d * k));
    camera.position.copy(controls.target).addScaledVector(offset, next / d);
  }

  /** Eases the camera `factor` times further out over `ms`, on top of whatever the wheel does. */
  function nudge(factor: number, ms: number) {
    push = { t0: performance.now(), ms, factor, done: 0 };
  }

  function update() {
    const a = anchor();
    if (!a) { controls.update(); return; }
    controls.minDistance = Math.min(a.radius * 1.12, camera.position.distanceTo(a.position));
    if (swing) {
      const t = Math.min(1, (performance.now() - swing.t0) / swing.ms);
      // The camera rides along with a moving anchor; only the pivot swings.
      camera.position.add(a.position.clone().sub(last));
      controls.target.copy(swing.from).lerp(a.position, ease(t));
      if (t >= 1) swing = null;
    } else if (flight) {
      const t = Math.min(1, (performance.now() - flight.t0) / flight.ms);
      const e = ease(t);
      const dist = Math.exp(Math.log(flight.fromDist) + (Math.log(flight.toDist) - Math.log(flight.fromDist)) * e);
      const dir = flight.fromDir.clone().lerp(flight.toDir, e).normalize();
      controls.target.copy(flight.fromTarget).lerp(a.position, e);
      camera.position.copy(controls.target).addScaledVector(dir, dist);
      if (t >= 1) flight = null;
    } else {
      const delta = a.position.clone().sub(last);
      controls.target.add(delta);
      camera.position.add(delta);
    }
    if (!flight) applyZoom();
    if (push && !flight) {
      const t = ease(Math.min(1, (performance.now() - push.t0) / push.ms));
      const offset = camera.position.clone().sub(controls.target);
      camera.position.copy(controls.target).addScaledVector(offset, Math.pow(push.factor, t - push.done));
      push.done = t;
      if (t >= 1) push = null;
    }
    last.copy(a.position);
    controls.update();
  }

  // OrbitControls caches the turn from `up` to +Y when it is built; a new up needs it again.
  const cached = controls as unknown as { _quat: THREE.Quaternion; _quatInverse: THREE.Quaternion };
  const yAxis = new THREE.Vector3(0, 1, 0);

  /** Which way is up on screen; it orbits about this axis too. */
  function setUp(up: THREE.Vector3) {
    if (camera.up.distanceToSquared(up) < 1e-10) return;
    camera.up.copy(up);
    cached._quat.setFromUnitVectors(up, yAxis);
    cached._quatInverse.copy(cached._quat).invert();
  }

  return { controls, setAnchor, retarget, nudge, wheel, scaleDistance, update, setUp, flying: () => flight !== null, swinging: () => swing !== null, dispose: () => controls.dispose() };
}
