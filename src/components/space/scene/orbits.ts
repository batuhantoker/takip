import * as THREE from 'three';
import { orbitPath, sub } from '@/lib/space/astro';
import { GM_EARTH } from '@/lib/space/frames';
import type { Vec3 } from '@/lib/space/horizons';
import type { SkyBody } from '@/lib/space/sky';

/** Orbit lines: each planet's osculating ellipse about the Sun, and the Moon's about Earth. */

const GM_EARTH_MOON = GM_EARTH + 4_902.8;

function loop(points: Vec3[], color: string, opacity: number): THREE.LineLoop {
  const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(points.flat()), 3));
  const line = new THREE.LineLoop(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
  line.frustumCulled = false;
  return line;
}

export function createOrbits() {
  const planets = new THREE.Group();
  /** Moved to Earth's position each frame; the Moon's ellipse is drawn about it. */
  const moonFrame = new THREE.Group();

  function setBodies(bodies: SkyBody[]) {
    planets.clear();
    moonFrame.clear();
    const earth = bodies.find(b => b.key === 'earth');
    for (const b of bodies) {
      if (b.kind === 'star') continue;
      if (b.key === 'moon') {
        if (!earth) continue;
        const path = orbitPath(sub(b.helio, earth.helio), sub(b.vel, earth.vel), GM_EARTH_MOON, 360);
        if (path) moonFrame.add(loop(path, b.color, 0.3));
        continue;
      }
      const path = orbitPath(b.helio, b.vel, undefined, 720);
      if (path) planets.add(loop(path, b.color, b.key === 'earth' ? 0.6 : 0.42));
    }
  }

  /** Planet orbits are sun-sized; up close to a body they are only stray lines across the view. */
  function fade(k: number) {
    planets.children.forEach(c => {
      const m = (c as THREE.LineLoop).material as THREE.LineBasicMaterial;
      m.opacity = (m.userData.base ?? (m.userData.base = m.opacity)) * k;
    });
  }

  return { planets, moonFrame, setBodies, fade };
}
