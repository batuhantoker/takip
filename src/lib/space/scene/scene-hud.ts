import * as THREE from 'three';
import { jdFromMs } from '@/lib/space/horizons';
import { MISSION_NOTES } from '@/lib/space/mission-notes';
import type { SpaceSelection } from '@/lib/space/selection';
import type { GlobeWorldId } from '@/lib/space/worlds';
import { REGION_COLOR, SHOWN_IN_SPACE } from './craft';
import { deepTargets, pickStar } from './deep-hud';
import type { LabelItem } from './labels';
import type { SpaceScene } from './space-scene';
import { ORBITER_COLOR, ROVER_COLOR, SITE_COLOR } from './surface-marks';

/** What the space view labels, and what a click lands on. */

const SUN_COLOR = '#FFD27A';
/** Surface marks get labels only once the camera is this many radii from their body. */
const SURFACE_LABEL_RADII = 40;

export interface Target { sel: SpaceSelection; position: THREE.Vector3; radiusPx: number; text: string; color: string; priority: number }

function pxPerKmAt(scene: SpaceScene, p: THREE.Vector3): number {
  const h = scene.renderer.domElement.clientHeight;
  return h / 2 / Math.tan((scene.camera.fov * Math.PI) / 360) / Math.max(1, p.distanceTo(scene.camera.position));
}

function surfaceTargets(scene: SpaceScene, world: GlobeWorldId, ms: number, out: Target[]) {
  const planet = scene.planets.get(world);
  if (!planet || !scene.layers.surface || scene.replay) return;
  if (planet.group.position.distanceTo(scene.camera.position) > planet.def.radiusKm * SURFACE_LABEL_RADII) return;
  const marks = scene.surfaces[world];
  const toWorld = (v: [number, number, number]) => new THREE.Vector3(...v).applyMatrix4(planet.spin.matrix).add(planet.group.position);
  const r = planet.def.radiusKm;
  const d = (lat: number, lng: number): [number, number, number] => {
    const la = lat * Math.PI / 180, lo = lng * Math.PI / 180;
    return [r * Math.cos(la) * Math.cos(lo), r * Math.cos(la) * Math.sin(lo), r * Math.sin(la)];
  };
  for (const s of marks.sites()) out.push({ sel: { kind: 'site', world, id: s.id }, position: toWorld(d(s.lat, s.lng)), radiusPx: 8, text: s.name, color: SITE_COLOR[s.kind], priority: s.kind === 'crewed' ? 45 : 35 });
  for (const v of marks.rovers()) out.push({ sel: { kind: 'rover', id: v.key }, position: toWorld(d(v.lat, v.lng)), radiusPx: 10, text: v.name, color: ROVER_COLOR, priority: 70 });
  marks.orbiterPositions(ms).forEach((p, i) => {
    const o = marks.orbiters()[i];
    if (p) out.push({ sel: { kind: 'orbiter', world, id: o.id }, position: toWorld(p), radiusPx: 9, text: o.name, color: ORBITER_COLOR, priority: 55 });
  });
}

function targets(scene: SpaceScene, jd: number, ms: number): Target[] {
  const out: Target[] = [{ sel: { kind: 'body', key: 'sun' }, position: new THREE.Vector3(), radiusPx: 0, text: 'Sun', color: SUN_COLOR, priority: 100 }];
  // Far out, the planets and craft all sit on the Sun's label; only the Sun stays.
  const planets = scene.fades.planets > 0.3, craft = scene.fades.craft > 0.3;
  for (const [key, p] of scene.planets) {
    if (!p.group.visible || !planets) continue;
    out.push({ sel: { kind: 'body', key }, position: p.group.position, radiusPx: 0, text: p.def.name, color: p.def.color, priority: key === 'earth' ? 98 : key === 'moon' ? 96 : 90 });
  }
  if (scene.layers.fleet && craft) {
    for (const c of scene.fleet) {
      if (!SHOWN_IN_SPACE(c)) continue;
      const p = scene.craftPosition(c, jd, ms);
      if (!p) continue;
      const note = MISSION_NOTES[c.id];
      out.push({ sel: { kind: 'craft', id: c.id }, position: new THREE.Vector3(...p), radiusPx: 9, text: c.name, color: REGION_COLOR[c.region], priority: note ? (note.ended ? 22 : 50) : 28 });
    }
  }
  surfaceTargets(scene, 'moon', ms, out);
  surfaceTargets(scene, 'mars', ms, out);
  deepTargets(scene, jd, out);
  for (const t of out) {
    if (t.sel.kind !== 'body') continue;
    const key = t.sel.key;
    const radiusKm = key === 'sun' ? 695_700 : scene.planets.get(key)!.def.radiusKm;
    t.radiusPx = Math.max(7, radiusKm * pxPerKmAt(scene, t.position));
  }
  return out;
}

const sameSel = (a: SpaceSelection | null, b: SpaceSelection) => JSON.stringify(a) === JSON.stringify(b);

export function labelItems(scene: SpaceScene, jd: number, ms: number): LabelItem[] {
  return targets(scene, jd, ms).map(t => {
    const selected = sameSel(scene.selection, t.sel);
    return {
      key: JSON.stringify(t.sel),
      text: t.text,
      color: t.color,
      priority: selected ? 1000 : t.priority,
      position: t.position,
      offset: Math.min(t.radiusPx, 400) + 4,
      selected,
      onClick: () => scene.select(t.sel),
    };
  });
}

/** The target under a click, nearest first; a body counts anywhere on its disc. */
export function pickAt(scene: SpaceScene, x: number, y: number, w: number, h: number): SpaceSelection | null {
  const ms = scene.timeMs();
  const jd = jdFromMs(ms);
  const v = new THREE.Vector3();
  let best: { sel: SpaceSelection; d: number } | null = null;
  for (const t of targets(scene, jd, ms)) {
    v.copy(t.position).project(scene.camera);
    if (v.z > 1 || v.z < -1) continue;
    const d = Math.hypot((v.x + 1) / 2 * w - x, (1 - v.y) / 2 * h - y);
    // Small marks win over a body they sit on, so a rover can be clicked on Mars.
    const score = d - (t.sel.kind === 'body' ? 0 : 6);
    if (d <= Math.max(t.radiusPx, 8) && (!best || score < best.d)) best = { sel: t.sel, d: score };
  }
  return best?.sel ?? pickStar(scene, x, y, w, h);
}
