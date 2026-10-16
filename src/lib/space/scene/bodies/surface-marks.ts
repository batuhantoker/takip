import * as THREE from 'three';
import { bodyPoint } from '@/lib/space/frames';
import type { Vec3 } from '@/lib/space/horizons';
import { LANDING_SITES, type LandingSite, type SiteKind } from '@/lib/space/craft/landing-sites';
import { trackAt, type SurfaceOrbiter, type SurfacePayload, type SurfaceRover } from '@/lib/space/bodies/surface';
import type { GlobeWorldId } from '@/lib/space/worlds';
import { dotTexture } from '../shared';

/**
 * What sits on or circles the Moon and Mars, in the body's own frame so it
 * turns with it: landing sites, the Mars rovers and their drives, and each
 * orbiter at its altitude with the arc it flies either side of now.
 */

export const SITE_COLOR: Record<SiteKind, string> = {
  crewed: '#F0D060',
  rover: '#00E5FF',
  lander: '#E8E6E0',
  'sample-return': '#B388FF',
};
export const ROVER_COLOR = '#FF9500';
export const ORBITER_COLOR = '#7CF7C4';
const ARC_HALF_MS = 50 * 60_000;
// Lifts marks off the surface so the sphere's own facets do not swallow them.
const LIFT_KM = 2;

const dot = dotTexture(32, 0.5);

function pointsOf(size: number) {
  const geometry = new THREE.BufferGeometry();
  const p = new THREE.Points(geometry, new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, map: dot, transparent: true, depthWrite: false, alphaTest: 0.05 }));
  p.frustumCulled = false;
  return p;
}

function setPoints(p: THREE.Points, positions: Vec3[], colors: string[]) {
  const c = new THREE.Color();
  p.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.flat()), 3));
  p.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors.flatMap(x => c.set(x).toArray())), 3));
}

export function createSurfaceMarks(world: GlobeWorldId, radiusKm: number) {
  const group = new THREE.Group();
  const sites = pointsOf(6);
  const rovers = pointsOf(9);
  const orbiters = pointsOf(7);
  const traverses = new THREE.Group();
  const arcs = new THREE.Group();
  group.add(traverses, arcs, sites, rovers, orbiters);

  const siteList: LandingSite[] = LANDING_SITES[world];
  setPoints(sites, siteList.map(s => bodyPoint(s.lat, s.lng, LIFT_KM, radiusKm)), siteList.map(s => SITE_COLOR[s.kind]));

  let roverList: SurfaceRover[] = [];
  let orbiterList: SurfaceOrbiter[] = [];

  function setSurface(p: SurfacePayload) {
    roverList = p.rovers;
    orbiterList = p.orbiters;
    setPoints(rovers, roverList.map(r => bodyPoint(r.lat, r.lng, LIFT_KM * 1.5, radiusKm)), roverList.map(() => ROVER_COLOR));
    traverses.clear();
    for (const r of roverList) {
      const pts = r.traverse.map(([lng, lat]) => bodyPoint(lat, lng, 0.4, radiusKm));
      if (pts.length < 2) continue;
      const line = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts.flat()), 3)), new THREE.LineBasicMaterial({ color: ROVER_COLOR }));
      line.frustumCulled = false;
      traverses.add(line);
    }
    setPoints(orbiters, orbiterList.map(() => [NaN, NaN, NaN] as Vec3), orbiterList.map(() => ORBITER_COLOR));
    arcs.clear();
    for (let i = 0; i < orbiterList.length; i++) {
      const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: ORBITER_COLOR, transparent: true, opacity: 0.45, depthWrite: false }));
      line.frustumCulled = false;
      arcs.add(line);
    }
  }

  /** Body-fixed position of each orbiter now, or null where its track does not reach. */
  function orbiterPositions(ms: number): (Vec3 | null)[] {
    return orbiterList.map(o => {
      const p = trackAt(o.track, ms);
      return p ? bodyPoint(p.lat, p.lng, p.altKm, radiusKm) : null;
    });
  }

  function update(ms: number) {
    const attr = orbiters.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!attr) return;
    orbiterPositions(ms).forEach((p, i) => attr.setXYZ(i, p ? p[0] : NaN, p ? p[1] : NaN, p ? p[2] : NaN));
    attr.needsUpdate = true;
    orbiterList.forEach((o, i) => {
      const pts = o.track.filter(t => Math.abs(t.t - ms) <= ARC_HALF_MS).flatMap(t => bodyPoint(t.lat, t.lng, t.altKm, radiusKm));
      (arcs.children[i] as THREE.Line).geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
    });
  }

  return {
    group, setSurface, update, orbiterPositions,
    sites: () => siteList, rovers: () => roverList, orbiters: () => orbiterList,
  };
}
