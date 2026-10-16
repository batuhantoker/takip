import * as THREE from 'three';
import type { FleetCraft } from '@/lib/space/craft/fleet';
import { CRAFT_MODELS } from '@/lib/space/craft/models';
import type { Vec3 } from '@/lib/space/horizons';
import { v3 } from '../shared';
import type { SpaceScene } from '../space-scene';
import { clearanceKm, landerPosition } from './landed';

/** Larger NASA models (Europa Clipper's is 36 MB) wait for a lighter version or an explicit choice. */
const MAX_MODEL_BYTES = 15e6;

/**
 * The fleet's dots, and the focus craft's model where one is loaded and
 * readable; landed, a craft is a dot on the ground. Placed after the camera
 * moves, since the model is sized for where the camera now is.
 */
export function placeCraft(scene: SpaceScene, jd: number, ms: number, earthPos: Vec3 | null, heightPx: number) {
  const focus = focusCraft(scene);
  const grounded = !!scene.replay?.model.landed(jd);
  scene.craftModel.show(focus ? String(focus.id) : null, focus ? CRAFT_MODELS[focus.id] ?? null : null);
  const focusAt = focus && !grounded ? craftPosition(scene, focus, jd, ms) : null;
  const at = focusAt && new THREE.Vector3(...focusAt);
  // Never drawn bigger than half its height: a probe the size of its own altitude reads as sitting on the planet.
  const drawn = scene.craftModel.update(at, earthPos ? v3(earthPos) : null, scene.camera, heightPx, at ? 0.5 * clearanceKm(at, scene.planets.values()) : Infinity);
  const modelled = drawn && focus ? focus.id : null;
  // Every frame: the camera follows a craft's exact position, so a dot moved less often steps against it.
  scene.craft.update(c => (c.id === modelled ? null : craftPosition(scene, c, jd, ms)));
}

/** The craft whose model to show: the one replayed, else followed, else selected; only those with a model of a sensible size. */
function focusCraft(scene: SpaceScene): FleetCraft | null {
  const id = scene.replay?.state.craftId
    ?? (scene.anchor.kind === 'craft' ? scene.anchor.id : null)
    ?? (scene.selection?.kind === 'craft' ? scene.selection.id : null);
  const model = id !== null ? CRAFT_MODELS[id] : undefined;
  if (id === null || !model || model.bytes > MAX_MODEL_BYTES) return null;
  return scene.fleet.find(c => c.id === id) ?? null;
}

/**
 * Moon and Mars craft come from their ground tracks, a lander from where it
 * stands; one that cannot be placed is not drawn.
 */
export function craftPosition(scene: SpaceScene, c: FleetCraft, jd: number, ms: number): [number, number, number] | null {
  if (scene.replay) return c.id === scene.replay.state.craftId ? scene.replay.model.craftAt(jd) : null;
  if (c.region !== 'moon' && c.region !== 'mars') return scene.model.craftPos(c, jd);
  const landed = landerPosition(c, scene.planets, scene.surfaces);
  if (landed) return [landed.x, landed.y, landed.z];
  const marks = scene.surfaces[c.region];
  const i = marks.orbiters().findIndex(o => o.id === c.id);
  const local = i >= 0 ? marks.orbiterPositions(ms)[i] : null;
  const planet = scene.planets.get(c.region);
  if (!local || !planet) return null;
  const w = new THREE.Vector3(...local).applyMatrix4(planet.spin.matrix).add(planet.group.position);
  return [w.x, w.y, w.z];
}
