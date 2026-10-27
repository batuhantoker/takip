import * as THREE from 'three';
import type { SpaceSelection } from '@/lib/space/selection';
import { inFront } from './labels';
import type { SpaceScene } from '../space-scene';

/** How near a click must land to a line, px. */
const PICK_PX = 6;

/** Who a line belongs to: its own body (`sel`), or, for the craft trails drawn as one, runs of its vertices. */
interface LineOwner { sel?: SpaceSelection; ranges?: { from: number; to: number; sel: SpaceSelection }[] }

const showing = (o: THREE.Object3D) => {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
};

function toSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

/** The orbit or trail a click lands on, the nearest within a few pixels: the planet, moon, dwarf planet or craft on it. */
export function pickOrbit(scene: SpaceScene, x: number, y: number, w: number, h: number): SpaceSelection | null {
  const forward = scene.camera.getWorldDirection(new THREE.Vector3());
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  const lines: THREE.Line[] = [];
  for (const root of [scene.orbits.planets, scene.orbits.moonFrame, scene.outer.lines, scene.craft.trails]) {
    root.traverse(o => { if ((o as THREE.Line).isLine && showing(o)) lines.push(o as THREE.Line); });
  }
  let best: { sel: SpaceSelection; d: number } | null = null;
  for (const line of lines) {
    const owner = line.userData as LineOwner;
    const pos = line.geometry.getAttribute('position');
    if (!pos || (line.material as THREE.LineBasicMaterial).opacity < 0.03 || (!owner.sel && !owner.ranges)) continue;
    const pairs = (line as THREE.LineSegments).isLineSegments, loop = (line as THREE.LineLoop).isLineLoop;
    const end = loop ? pos.count : pos.count - 1;
    for (let i = 0; i < end; i += pairs ? 2 : 1) {
      a.fromBufferAttribute(pos, i).applyMatrix4(line.matrixWorld);
      b.fromBufferAttribute(pos, (i + 1) % pos.count).applyMatrix4(line.matrixWorld);
      if (!inFront(scene.camera, a, forward) || !inFront(scene.camera, b, forward)) continue;
      a.project(scene.camera);
      b.project(scene.camera);
      const d = toSegment(x, y, (a.x + 1) / 2 * w, (1 - a.y) / 2 * h, (b.x + 1) / 2 * w, (1 - b.y) / 2 * h);
      if (d >= PICK_PX || (best && d >= best.d)) continue;
      const sel = owner.sel ?? owner.ranges?.find(r => i >= r.from && i < r.to)?.sel;
      if (sel) best = { sel, d };
    }
  }
  return best?.sel ?? null;
}
