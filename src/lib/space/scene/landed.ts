import * as THREE from 'three';
import type { FleetCraft } from '@/lib/space/fleet';
import { bodyPoint } from '@/lib/space/frames';
import { LANDER_SITES, LANDING_SITES } from '@/lib/space/landing-sites';
import { SURFACE_LIFT_KM } from '@/lib/space/replay-landing';
import type { Planet } from './bodies';
import type { Anchor, SpaceScene } from './space-scene';
import type { createSurfaceMarks } from './surface-marks';

/**
 * Craft on the ground: a lander or rover drawn where it stands on its body,
 * turning with it, and a camera that rides round with the ground under it.
 */

type Marks = ReturnType<typeof createSurfaceMarks>;

/** A fleet lander's place today, scene km: a rover where NASA last placed it, else its landing site. */
export function landerPosition(c: FleetCraft, planets: Map<string, Planet>, surfaces: Record<string, Marks>): THREE.Vector3 | null {
  const at = LANDER_SITES[c.id];
  const planet = at && planets.get(at.world);
  if (!at || !planet) return null;
  const rover = at.rover ? surfaces[at.world]?.rovers().find(r => r.key === at.rover) : undefined;
  const site = rover ?? LANDING_SITES[at.world].find(s => s.id === at.site);
  if (!site) return null;
  return new THREE.Vector3(...bodyPoint(site.lat, site.lng, SURFACE_LIFT_KM, planet.def.radiusKm)).applyMatrix4(planet.spin.matrix).add(planet.group.position);
}

/** The camera turns with the ground a followed craft stands on, so the craft stays where it was seen from. */
function createGroundFollow() {
  let last: { key: string; turn: THREE.Matrix4 } | null = null;
  const step = new THREE.Matrix4();
  const offset = new THREE.Vector3();

  /** `ground` is the body under the craft and its body-fixed-to-scene turn now; null when the craft is not on one. */
  function update(camera: THREE.PerspectiveCamera, target: THREE.Vector3, ground: { key: string; turn: THREE.Matrix4 } | null) {
    if (ground && last?.key === ground.key) {
      step.copy(ground.turn).multiply(last.turn.clone().invert());
      offset.subVectors(camera.position, target).applyMatrix4(step);
      camera.position.copy(target).add(offset);
      camera.lookAt(target);
    }
    last = ground ? { key: ground.key, turn: ground.turn.clone() } : null;
  }

  return { update, reset: () => { last = null; } };
}

/** How far a craft is above the nearest body's surface, km. */
export function clearanceKm(p: THREE.Vector3, planets: Iterable<Planet>): number {
  let km = Infinity;
  for (const b of planets) if (b.group.visible) km = Math.min(km, p.distanceTo(b.group.position) - b.def.radiusKm);
  return km;
}

/**
 * Swings a following camera round, over `seconds`, to stand above `up` (a
 * unit direction from the craft): out beyond the craft from the body's centre,
 * it looks down past the craft at the ground it climbs from or comes down to.
 */
function steerTowards(camera: THREE.PerspectiveCamera, target: THREE.Vector3, up: THREE.Vector3, dtSec: number, seconds: number) {
  const offset = camera.position.clone().sub(target);
  const d = offset.length();
  if (!d) return;
  const dir = offset.divideScalar(d);
  const turn = new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(dir, up), 1 - Math.exp(-dtSec / seconds));
  camera.position.copy(target).addScaledVector(dir.applyQuaternion(turn), d);
  camera.lookAt(target);
}

/** Out from the ground a craft stands on or is near (the pad, its landing site): a camera there looks down past it. */
export function overGround(scene: SpaceScene, anchor: Anchor, jd: number): THREE.Vector3 | undefined {
  if (anchor.kind !== 'craft') return undefined;
  const r = scene.replay, l = r?.model.landing;
  const key = r
    ? anchor.id !== r.state.craftId ? null : r.model.ascending(jd) ? 'earth' : l && jd >= l.from ? l.body : null
    : LANDER_SITES[anchor.id]?.world;
  const centre = key ? scene.planets.get(key)?.group.position : undefined;
  const at = centre && scene.anchorState(anchor, jd)?.position;
  return at ? at.sub(centre).normalize() : undefined;
}

/** The body under the anchored craft and its turn now, when the craft stands on one. */
function groundUnder(scene: SpaceScene, jd: number): { key: string; turn: THREE.Matrix4 } | null {
  const a = scene.anchor, r = scene.replay;
  if (a.kind !== 'craft') return null;
  const key = r ? (a.id === r.state.craftId && r.model.landed(jd) ? r.model.landing?.body : null) : LANDER_SITES[a.id]?.world;
  const p = key ? scene.planets.get(key) : undefined;
  return key && p ? { key, turn: p.spin.matrix } : null;
}

/**
 * On the ground the camera turns with it. Climbing from the pad or coming in
 * to land, a following camera swings out beyond the craft from the body's
 * centre, so it looks down past the craft at the ground.
 */
export function createGroundCamera(scene: SpaceScene) {
  const follow = createGroundFollow();
  let lastWall = 0;
  return {
    update(jd: number, wall: number) {
      const dt = lastWall ? Math.min(0.1, (wall - lastWall) / 1000) : 0;
      lastWall = wall;
      const { camera, rig, replay } = scene;
      const flying = rig.flying();
      follow.update(camera, rig.controls.target, flying ? null : groundUnder(scene, jd));
      if (!replay?.state.follow || flying || replay.model.landed(jd)) return;
      const up = overGround(scene, scene.anchor, jd);
      if (up) steerTowards(camera, rig.controls.target, up, dt, 1.5);
    },
  };
}
