import * as THREE from 'three';
import type { StarCatalog } from '@/lib/space/earth-sky-layer';
import { EQUATORIAL_TO_ECLIPTIC, mul } from '@/lib/space/frames';
import { raDecVector, starColor } from '@/lib/space/sky-projection';
import { dotTexture } from './shared';

/**
 * The bright-star catalogue on a sphere far beyond Voyager, so it never shows
 * parallax and never clips. Stars are J2000 equatorial; the scene is ecliptic.
 */

const SKY_RADIUS_KM = 5e11;

export function createStars(catalog: StarCatalog): THREE.Points {
  const pos = new Float32Array(catalog.stars.length * 3);
  const col = new Float32Array(catalog.stars.length * 3);
  catalog.stars.forEach(([ra, dec, mag, bv], i) => {
    const d = mul(EQUATORIAL_TO_ECLIPTIC, raDecVector(ra, dec));
    pos.set(d.map(x => x * SKY_RADIUS_KM), i * 3);
    // Brightness rides on the colour: PointsMaterial has one size for all.
    const k = Math.max(0.12, Math.min(1, 1.15 - 0.17 * mag));
    col.set(starColor(bv).map(c => c * k), i * 3);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({
    size: 2.4, sizeAttenuation: false, vertexColors: true, map: dotTexture(32, 0.3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  points.frustumCulled = false;
  points.renderOrder = -1;
  return points;
}
