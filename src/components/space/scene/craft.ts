import * as THREE from 'three';
import type { FleetCraft, Region } from '@/lib/space/fleet';
import type { Vec3 } from '@/lib/space/horizons';
import { dotTexture } from './shared';

/**
 * The Horizons fleet as points that stay a few pixels across at any distance,
 * with each cruising craft's past year as a faint trail. Earth-orbit craft are
 * left to the satellite layer, which has the whole catalogue.
 */

export const REGION_COLOR: Record<Region, string> = {
  'earth-orbit': '#00E5FF',
  cislunar: '#7FDBFF',
  moon: '#7CF7C4',
  'sun-earth-l1': '#FFD27A',
  'sun-earth-l2': '#C9A2FF',
  mercury: '#B9AC9F',
  venus: '#EBD3A2',
  mars: '#FF8A5C',
  jupiter: '#E3B98A',
  saturn: '#E6CF8B',
  interplanetary: '#F0D060',
  outer: '#9FD8E0',
  interstellar: '#FF7AD9',
};

export const SHOWN_IN_SPACE = (c: FleetCraft) => c.region !== 'earth-orbit';

export function createCraftLayer() {
  const geometry = new THREE.BufferGeometry();
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({
    size: 7, sizeAttenuation: false, vertexColors: true, map: dotTexture(32, 0.5), transparent: true, depthWrite: false, alphaTest: 0.05,
  }));
  points.frustumCulled = false;
  points.renderOrder = 3;

  const trailGeometry = new THREE.BufferGeometry();
  const trails = new THREE.LineSegments(trailGeometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.35, depthWrite: false }));
  trails.frustumCulled = false;

  let shown: FleetCraft[] = [];

  function setFleet(craft: FleetCraft[]) {
    shown = craft.filter(SHOWN_IN_SPACE);
    const col = new Float32Array(shown.length * 3);
    const c = new THREE.Color();
    shown.forEach((k, i) => col.set(c.set(REGION_COLOR[k.region]).toArray(), i * 3));
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(shown.length * 3), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));

    const seg: number[] = [];
    const segCol: number[] = [];
    for (const k of shown) {
      const rgb = c.set(REGION_COLOR[k.region]).toArray();
      const path = [...k.trail, k.helio];
      for (let i = 1; i < path.length; i++) {
        seg.push(...path[i - 1], ...path[i]);
        segCol.push(...rgb, ...rgb);
      }
    }
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(seg), 3));
    trailGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(segCol), 3));
  }

  /** Moves every point to `positionOf(craft)`; craft with no position are parked out of sight. */
  function update(positionOf: (c: FleetCraft) => Vec3 | null) {
    const attr = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!attr) return;
    shown.forEach((k, i) => {
      const p = positionOf(k);
      if (p) attr.setXYZ(i, p[0], p[1], p[2]);
      else attr.setXYZ(i, NaN, NaN, NaN);
    });
    attr.needsUpdate = true;
  }

  return { points, trails, setFleet, update, shown: () => shown };
}
