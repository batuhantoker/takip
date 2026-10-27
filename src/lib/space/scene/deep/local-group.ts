import * as THREE from 'three';
import { LY_KM } from '@/lib/space/astro';
import { galaxyPosition, NEARBY_GALAXIES } from '@/lib/space/deep/features';
import { v3 } from '../shared';

/**
 * The Milky Way's neighbours, from the Magellanic Clouds out to Andromeda and
 * Triangulum: each a soft glow at its catalogued position, drawn to its size.
 */

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,248,235,1)');
  grad.addColorStop(0.2, 'rgba(225,225,255,0.55)');
  grad.addColorStop(0.6, 'rgba(160,170,230,0.12)');
  grad.addColorStop(1, 'rgba(120,130,200,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function createLocalGroup() {
  const group = new THREE.Group();
  const map = glowTexture();
  const sprites = NEARBY_GALAXIES.map(gx => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.copy(v3(galaxyPosition(gx)));
    s.scale.setScalar(gx.diameterLy * LY_KM);
    s.frustumCulled = false;
    group.add(s);
    return s;
  });

  /** `pictured(id)` is how much of a galaxy's photograph is showing; its glow gives way to it. */
  function update(k: number, pictured: (id: string) => number = () => 0) {
    sprites.forEach((s, i) => { (s.material as THREE.SpriteMaterial).opacity = 0.7 * k * (1 - pictured(NEARBY_GALAXIES[i].id)); });
    group.visible = k > 0.005;
  }

  return { group, update };
}
