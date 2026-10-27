import * as THREE from 'three';
import { AU_KM, GM_SUN, orbitPath } from '@/lib/space/astro';
import { drift } from '@/lib/space/frames';
import type { Vec3 } from '@/lib/space/horizons';
import { distantClass, type OuterBody, type OuterPayload } from '@/lib/space/deep/outer';
import { AbsolutePositions } from '../floating-origin';
import { dotTexture } from '../shared';

/**
 * Past Neptune: the dwarf planets with their orbits, the interstellar
 * visitors on their real paths through the solar system, and the Minor Planet
 * Center's distant minor planets as a field of faint points.
 */

const CLASS_COLOR = { centaur: '#E8B96A', kuiper: '#9FC4E8', scattered: '#B79CE8' } as const;

export function createOuterBodies() {
  const group = new THREE.Group();
  const lines = new THREE.Group();
  group.add(lines);

  const bodyPoints = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({
    size: 6, sizeAttenuation: false, vertexColors: true, map: dotTexture(32, 0.5), transparent: true, depthWrite: false, alphaTest: 0.05,
  }));
  bodyPoints.frustumCulled = false;
  // Bodies off their known span are NaN; three would sort by a NaN bounding sphere otherwise.
  bodyPoints.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
  bodyPoints.renderOrder = 3;
  group.add(bodyPoints);

  const distantMaterial = new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const distant = new THREE.Points(new THREE.BufferGeometry(), distantMaterial);
  distant.frustumCulled = false;
  group.add(distant);

  let bodies: OuterBody[] = [];
  let epochJd = 0;
  // Everything here is drawn about the floating origin, with `group` standing on it.
  let km: AbsolutePositions[] = [];
  let dots: AbsolutePositions | null = null;

  function line(points: Vec3[], color: string, opacity: number, loop: boolean, key: string) {
    const positions = new AbsolutePositions(group, points.flat());
    km.push(positions);
    const geometry = new THREE.BufferGeometry().setAttribute('position', positions.attribute);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    material.userData.base = opacity;
    const l = loop ? new THREE.LineLoop(geometry, material) : new THREE.Line(geometry, material);
    l.userData.sel = { kind: 'outer', key };
    l.frustumCulled = false;
    return l;
  }

  function setOuter(p: OuterPayload, jd: number) {
    bodies = p.bodies;
    epochJd = jd;
    lines.children.forEach(c => (c as THREE.Line).geometry.dispose());
    lines.clear();
    km = [];
    for (const b of bodies) {
      if (b.path?.length) lines.add(line(b.path.map(r => r.pos), b.color, 0.35, false, b.key));
      else {
        const path = orbitPath(b.helio, b.vel, undefined, 720);
        if (path) lines.add(line(path, b.color, 0.22, true, b.key));
      }
    }
    const col = new Float32Array(bodies.flatMap(b => new THREE.Color(b.color).toArray()));
    dots = new AbsolutePositions(group, bodies.length);
    km.push(dots);
    bodyPoints.geometry.setAttribute('position', dots.attribute);
    bodyPoints.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));

    const pos = new Float64Array(p.distant.length * 3);
    const dcol = new Float32Array(p.distant.length * 3);
    const c = new THREE.Color();
    p.distant.forEach(([x, y, z, , a], i) => {
      pos.set([x * AU_KM, y * AU_KM, z * AU_KM], i * 3);
      dcol.set(c.set(CLASS_COLOR[distantClass(a)]).toArray(), i * 3);
    });
    const far = new AbsolutePositions(group, pos);
    km.push(far);
    distant.geometry.setAttribute('position', far.attribute);
    distant.geometry.setAttribute('color', new THREE.BufferAttribute(dcol, 3));
  }

  /** Now, or on a replay's date: a visitor from its path, a dwarf planet only near the epoch, where drift holds. */
  function positionOf(b: OuterBody, jd: number): Vec3 | null {
    if (b.path?.length && jd >= b.path[0].jd && jd <= b.path[b.path.length - 1].jd) {
      const i = Math.max(1, b.path.findIndex(r => r.jd >= jd));
      const a = b.path[i - 1], c = b.path[i];
      const f = (jd - a.jd) / Math.max(1e-9, c.jd - a.jd);
      return [a.pos[0] + (c.pos[0] - a.pos[0]) * f, a.pos[1] + (c.pos[1] - a.pos[1]) * f, a.pos[2] + (c.pos[2] - a.pos[2]) * f];
    }
    return Math.abs(jd - epochJd) < 60 ? drift(b.helio, b.vel, (jd - epochJd) * 86_400, GM_SUN) : null;
  }

  /**
   * `near` fades the bodies and paths, `belt` the field of distant minor planets; a replay hides the belt, which is
   * placed for today. The `picked` body's path stands out.
   */
  function update(jd: number, near: number, belt: number, replay = false, picked?: string) {
    if (dots) bodies.forEach((b, i) => dots!.setXYZ(i, ...(positionOf(b, jd) ?? [NaN, NaN, NaN] as Vec3)));
    if (replay) belt = 0;
    (bodyPoints.material as THREE.PointsMaterial).opacity = near;
    bodyPoints.visible = near > 0.01;
    lines.children.forEach(l => {
      const m = (l as THREE.Line).material as THREE.LineBasicMaterial;
      m.opacity = Math.min(1, m.userData.base * near * (l.userData.sel?.key === picked ? 2.2 : 1));
    });
    lines.visible = near > 0.01;
    distantMaterial.opacity = 0.55 * belt;
    distant.visible = belt > 0.01;
  }

  return {
    group, lines, setOuter, update, bodies: () => bodies, positionOf,
    rebase: (origin: THREE.Vector3) => km.forEach(k => k.rebase(origin)),
    distantCount: () => (distant.geometry.getAttribute('position')?.count ?? 0),
  };
}
