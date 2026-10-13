import * as THREE from 'three';
import { orbitPath, sub } from '@/lib/space/astro';
import { GM_EARTH } from '@/lib/space/frames';
import type { SkyBody } from '@/lib/space/sky';
import { AbsolutePositions } from './floating-origin';

/** Orbit lines: each planet's osculating ellipse about the Sun, and the Moon's about Earth. */

const GM_EARTH_MOON = GM_EARTH + 4_902.8;

function loop(color: string, opacity: number): THREE.LineLoop {
  const line = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
  line.frustumCulled = false;
  return line;
}

export function createOrbits() {
  const planets = new THREE.Group();
  /** Moved to Earth's position each frame; the Moon's ellipse is drawn about it. */
  const moonFrame = new THREE.Group();
  let ellipses: AbsolutePositions[] = [];

  function setBodies(bodies: SkyBody[]) {
    planets.children.forEach(c => (c as THREE.LineLoop).geometry.dispose());
    planets.clear();
    moonFrame.clear();
    ellipses = [];
    const earth = bodies.find(b => b.key === 'earth');
    for (const b of bodies) {
      if (b.kind === 'star') continue;
      if (b.key === 'moon') {
        if (!earth) continue;
        const path = orbitPath(sub(b.helio, earth.helio), sub(b.vel, earth.vel), GM_EARTH_MOON, 360);
        if (!path) continue;
        const line = loop(b.color, 0.3);
        line.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(path.flat()), 3));
        moonFrame.add(line);
        continue;
      }
      const path = orbitPath(b.helio, b.vel, undefined, 720);
      if (!path) continue;
      const line = loop(b.color, b.key === 'earth' ? 0.6 : 0.42);
      const km = new AbsolutePositions(line, path.flat());
      line.geometry.setAttribute('position', km.attribute);
      ellipses.push(km);
      planets.add(line);
    }
  }

  /** Planet orbits are sun-sized; up close to a body they are only stray lines across the view. */
  function fade(k: number) {
    planets.children.forEach(c => {
      const m = (c as THREE.LineLoop).material as THREE.LineBasicMaterial;
      m.opacity = (m.userData.base ?? (m.userData.base = m.opacity)) * k;
    });
  }

  return { planets, moonFrame, setBodies, fade, rebase: (origin: THREE.Vector3) => ellipses.forEach(e => e.rebase(origin)) };
}
