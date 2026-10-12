import * as THREE from 'three';

/**
 * Text over the space view: DOM labels projected each frame, laid out
 * highest-priority first so a crowd at L2 or around Earth does not become a
 * smear, and hidden when a planet stands between them and the camera.
 */

export interface LabelItem {
  key: string;
  text: string;
  color: string;
  priority: number;
  position: THREE.Vector3;
  /** Pixels to the right of the point; bodies push their label past their disc. */
  offset?: number;
  selected?: boolean;
  onClick?: () => void;
}

export interface Occluder { center: THREE.Vector3; radius: number }

const tmp = new THREE.Vector3();
const toTarget = new THREE.Vector3();
const toCentre = new THREE.Vector3();

function hidden(camera: THREE.Camera, target: THREE.Vector3, occluders: Occluder[]): boolean {
  toTarget.subVectors(target, camera.position);
  const dist = toTarget.length();
  toTarget.divideScalar(dist);
  for (const o of occluders) {
    toCentre.subVectors(o.center, camera.position);
    const along = toCentre.dot(toTarget);
    if (along <= 0 || along - o.radius > dist) continue;
    const miss = toCentre.lengthSq() - along * along;
    // Inside the sphere's silhouette, and the sphere is nearer than the target.
    if (miss < o.radius * o.radius && along < dist - o.radius * 0.01) return true;
  }
  return false;
}

export function createLabels(root: HTMLElement) {
  const layer = document.createElement('div');
  layer.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;';
  root.appendChild(layer);
  const els = new Map<string, HTMLDivElement>();

  function element(item: LabelItem): HTMLDivElement {
    let el = els.get(item.key);
    if (!el) {
      el = document.createElement('div');
      el.style.cssText = 'position:absolute;left:0;top:0;white-space:nowrap;font:500 10px var(--font-hud, monospace);letter-spacing:0.05em;text-shadow:0 0 3px #000,0 0 7px #000;will-change:transform;cursor:pointer;pointer-events:auto;padding:1px 3px;border-radius:3px;';
      layer.appendChild(el);
      els.set(item.key, el);
    }
    if (el.textContent !== item.text) el.textContent = item.text;
    el.style.color = item.color;
    el.style.background = item.selected ? 'rgba(212,175,55,0.18)' : 'transparent';
    el.onclick = item.onClick ? (e => { e.stopPropagation(); item.onClick!(); }) : null;
    return el;
  }

  function update(items: LabelItem[], camera: THREE.PerspectiveCamera, width: number, height: number, occluders: Occluder[]) {
    const boxes: [number, number, number, number][] = [];
    const shown = new Set<string>();
    for (const item of [...items].sort((a, b) => b.priority - a.priority)) {
      tmp.copy(item.position).project(camera);
      if (tmp.z > 1 || tmp.z < -1 || Math.abs(tmp.x) > 1.1 || Math.abs(tmp.y) > 1.1) continue;
      if (hidden(camera, item.position, occluders)) continue;
      const x = (tmp.x + 1) / 2 * width + (item.offset ?? 6);
      const y = (1 - tmp.y) / 2 * height - 7;
      const w = item.text.length * 6.2 + 8, h = 14;
      if (!item.selected && boxes.some(([bx, by, bw, bh]) => x < bx + bw && x + w > bx && y < by + bh && y + h > by)) continue;
      boxes.push([x, y, w, h]);
      const el = element(item);
      el.style.display = 'block';
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      shown.add(item.key);
    }
    els.forEach((el, key) => { if (!shown.has(key)) el.style.display = 'none'; });
  }

  return { update, dispose: () => layer.remove() };
}
