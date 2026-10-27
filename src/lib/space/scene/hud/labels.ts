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

/** In front of the camera. With a far plane of 1e25 km, a point light-years behind it projects to z = 1 exactly, not past it. */
export function inFront(camera: THREE.Camera, p: THREE.Vector3, forward = camera.getWorldDirection(new THREE.Vector3())): boolean {
  return toTarget.subVectors(p, camera.position).dot(forward) > 0;
}

const tmp = new THREE.Vector3();
const forward = new THREE.Vector3();
const toTarget = new THREE.Vector3();
const toCentre = new THREE.Vector3();

function hidden(camera: THREE.Camera, target: THREE.Vector3, occluders: Occluder[]): boolean {
  toTarget.subVectors(target, camera.position);
  const dist = toTarget.length();
  toTarget.divideScalar(dist);
  for (const o of occluders) {
    // A body never hides its own label; light-years out, rounding would otherwise put the Sun behind itself.
    if (o.center.distanceToSquared(target) < 0.25 * o.radius * o.radius) continue;
    toCentre.subVectors(o.center, camera.position);
    const along = toCentre.dot(toTarget);
    if (along <= 0 || along - o.radius > dist) continue;
    // |v|² − along² cancels to noise light-years out; the cross product keeps the sideways miss exact.
    const miss = toCentre.cross(toTarget).lengthSq();
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

  // Words in Geist on a dark halo; the marker beside each label already carries its colour.
  function element(item: LabelItem): HTMLDivElement {
    let el = els.get(item.key);
    if (!el) {
      el = document.createElement('div');
      el.style.cssText = 'position:absolute;left:0;top:0;white-space:nowrap;font:500 11px/14px var(--font-body, system-ui, sans-serif);text-shadow:0 0 2px rgba(10,12,15,0.95),0 1px 3px rgba(10,12,15,0.9);will-change:transform;cursor:pointer;pointer-events:auto;padding:1px 5px;border-radius:4px;';
      layer.appendChild(el);
      els.set(item.key, el);
    }
    if (el.textContent !== item.text) el.textContent = item.text;
    el.style.color = item.selected || item.priority >= 90 ? 'var(--ink-1, #ECEEF0)' : 'var(--ink-2, #A4AAB2)';
    el.style.background = item.selected ? 'var(--surface-3, #1E2228)' : 'transparent';
    el.style.boxShadow = item.selected ? 'inset 0 0 0 1px var(--line-strong, rgba(255,255,255,0.12))' : 'none';
    el.onclick = item.onClick ? (e => { e.stopPropagation(); item.onClick!(); }) : null;
    return el;
  }

  function update(items: LabelItem[], camera: THREE.PerspectiveCamera, width: number, height: number, occluders: Occluder[]) {
    const boxes: [number, number, number, number][] = [];
    const shown = new Set<string>();
    camera.getWorldDirection(forward);
    for (const item of [...items].sort((a, b) => b.priority - a.priority)) {
      if (!inFront(camera, item.position, forward)) continue;
      tmp.copy(item.position).project(camera);
      if (tmp.z > 1 || tmp.z < -1 || Math.abs(tmp.x) > 1.1 || Math.abs(tmp.y) > 1.1) continue;
      if (hidden(camera, item.position, occluders)) continue;
      const x = (tmp.x + 1) / 2 * width + (item.offset ?? 6);
      const y = (1 - tmp.y) / 2 * height - 7;
      const w = item.text.length * 6.2 + 10, h = 16;
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
