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
  controls.maxDistance = 3e11;

  let anchor: () => AnchorState | null = () => null;
  const last = new THREE.Vector3();
  let hasLast = false;
  let flight: { t0: number; fromTarget: THREE.Vector3; fromDir: THREE.Vector3; fromDist: number; toDir: THREE.Vector3; toDist: number } | null = null;

  /** Re-anchors and flies there; `direction` is where the camera ends up, seen from the anchor. */
  function setAnchor(next: () => AnchorState | null, distance: number, direction?: THREE.Vector3, instant = false) {
    anchor = next;
    const a = next();
    if (!a) return;
    const offset = camera.position.clone().sub(controls.target);
    const fromDist = Math.max(offset.length(), 1);
    const toDir = (direction ?? offset).clone().normalize();
    if (instant || !hasLast) {
      controls.target.copy(a.position);
      camera.position.copy(a.position).addScaledVector(toDir, distance);
      flight = null;
    } else {
      flight = { t0: performance.now(), fromTarget: controls.target.clone(), fromDir: offset.normalize(), fromDist, toDir, toDist: distance };
    }
    last.copy(a.position);
    hasLast = true;
  }

  function update() {
    const a = anchor();
    if (!a) { controls.update(); return; }
    controls.minDistance = a.radius * 1.12;
    if (flight) {
      const t = Math.min(1, (performance.now() - flight.t0) / FLY_MS);
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
    last.copy(a.position);
    controls.update();
  }

  return { controls, setAnchor, update, flying: () => flight !== null, dispose: () => controls.dispose() };
}
