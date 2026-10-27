import * as THREE from 'three';
import type { FleetCraft, Region } from '@/lib/space/craft/fleet';
import type { Vec3 } from '@/lib/space/horizons';
import { AbsolutePositions } from '../floating-origin';
import { dotTexture } from '../shared';

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

const TRAIL_WEEKS = 26;
const TRAIL_OPACITY = 0.2;

export function createCraftLayer() {
  const geometry = new THREE.BufferGeometry();
  // Parked craft are NaN, which three would turn into a NaN bounding sphere when it sorts.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({
    size: 7, sizeAttenuation: false, vertexColors: true, map: dotTexture(32, 0.5), transparent: true, depthWrite: false, alphaTest: 0.05,
  }));
  points.frustumCulled = false;
  points.renderOrder = 3;

  const trailGeometry = new THREE.BufferGeometry();
  const trailMaterial = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: TRAIL_OPACITY, depthWrite: false });
  const trails = new THREE.LineSegments(trailGeometry, trailMaterial);
  trails.frustumCulled = false;

  let shown: FleetCraft[] = [];
  let dots: AbsolutePositions | null = null;
  let trailKm: AbsolutePositions | null = null;

  function setFleet(craft: FleetCraft[]) {
    shown = craft.filter(SHOWN_IN_SPACE);
    const col = new Float32Array(shown.length * 3);
    const c = new THREE.Color();
    shown.forEach((k, i) => col.set(c.set(REGION_COLOR[k.region]).toArray(), i * 3));
    dots = new AbsolutePositions(points, shown.length);
    geometry.setAttribute('position', dots.attribute);
    geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));

    const seg: number[] = [];
    const segCol: number[] = [];
    // Which craft each run of trail vertices belongs to, for clicks on a trail.
    const ranges: { from: number; to: number; sel: { kind: 'craft'; id: FleetCraft['id'] } }[] = [];
    for (const k of shown) {
      const from = seg.length / 3;
      const rgb = c.set(REGION_COLOR[k.region]).toArray();
      // Half a year: a full year around 1 AU just redraws Earth's orbit once per craft trailing it.
      const path = [...k.trail.slice(-TRAIL_WEEKS), k.helio];
      for (let i = 1; i < path.length; i++) {
        seg.push(...path[i - 1], ...path[i]);
        segCol.push(...rgb, ...rgb);
      }
      ranges.push({ from, to: seg.length / 3, sel: { kind: 'craft', id: k.id } });
    }
    trails.userData.ranges = ranges;
    trailKm = new AbsolutePositions(trails, seg);
    trailGeometry.setAttribute('position', trailKm.attribute);
    trailGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(segCol), 3));
  }

  /** Moves every point to `positionOf(craft)`; craft with no position are parked out of sight. */
  function update(positionOf: (c: FleetCraft) => Vec3 | null) {
    if (!dots) return;
    shown.forEach((k, i) => {
      const p = positionOf(k);
      if (p) dots!.setXYZ(i, p[0], p[1], p[2]);
      else dots!.setXYZ(i, NaN, NaN, NaN);
    });
  }

  function rebase(origin: THREE.Vector3) {
    dots?.rebase(origin);
    trailKm?.rebase(origin);
  }

  return { points, trails, setFleet, update, rebase, shown: () => shown, fade: (k: number) => { trailMaterial.opacity = TRAIL_OPACITY * k; } };
}
