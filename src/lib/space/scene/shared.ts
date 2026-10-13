import * as THREE from 'three';
import type { Mat3 } from '@/lib/space/frames';
import type { Vec3 } from '@/lib/space/horizons';

export const v3 = (v: Vec3, out = new THREE.Vector3()) => out.set(v[0], v[1], v[2]);

export function rotation(m: Mat3, out = new THREE.Matrix4()): THREE.Matrix4 {
  return out.set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1);
}

/**
 * A sphere whose local axes are body-fixed: x through (0°, 0°), y through
 * (0°, 90°E), z the north pole. Three's sphere puts 0° on +x, 90°E on −z and
 * north on +y with the equirectangular seam at 180°, so a quarter turn about x
 * lines the texture up with lib/space/frames.
 */
export function bodyGeometry(radiusKm: number, segments = 96): THREE.SphereGeometry {
  const g = new THREE.SphereGeometry(radiusKm, segments, segments / 2);
  g.rotateX(Math.PI / 2);
  return g;
}

/** Log-depth chunks a custom shader needs once the renderer uses a logarithmic depth buffer. */
export const LOGDEPTH = {
  vertexPars: '#include <common>\n#include <logdepthbuf_pars_vertex>',
  vertex: '#include <logdepthbuf_vertex>',
  fragmentPars: '#include <common>\n#include <logdepthbuf_pars_fragment>',
  fragment: '#include <logdepthbuf_fragment>',
};

const loader = new THREE.TextureLoader();

export function loadTexture(url: string, onLoad?: (t: THREE.Texture) => void): THREE.Texture {
  return loader.load(url, t => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    onLoad?.(t);
  });
}

/** A soft round dot, for sprites and points that should not be squares. */
export function dotTexture(size = 64, soft = 0.55): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(soft, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
