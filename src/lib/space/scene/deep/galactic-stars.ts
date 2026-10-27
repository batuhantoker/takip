import * as THREE from 'three';
import { LY_KM } from '@/lib/space/astro';
import { EQUATORIAL_TO_ECLIPTIC } from '@/lib/space/frames';
import type { GalacticStars } from '@/lib/space/deep/galactic-stars';
import { starColor } from '@/lib/space/globe/sky-projection';
import { AbsolutePositions } from '../floating-origin';
import { LOGDEPTH, rotation } from '../shared';

/**
 * The Milky Way around the Sun from Gaia DR3: a couple of hundred thousand real stars between the nearby ones and
 * the galaxy's disc. Like the nearby stars each one's brightness is worked out from the camera, but they are drawn
 * fainter and smaller, so together they read as the galaxy's body rather than as a second star field.
 */

const VERT = `
${LOGDEPTH.vertexPars}
attribute float absMag;
attribute vec3 color;
uniform float pixelRatio;
uniform float floorBright;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // Parsecs from the camera; the model matrix is in km.
  float pc = max(length(mv.xyz) / 3.0857e13, 1e-9);
  float m = absMag + 5.0 * log2(pc) * 0.30103 - 5.0;
  float k = clamp(0.95 - 0.17 * m, floorBright, 0.85);
  vColor = color * k;
  gl_PointSize = (1.8 + clamp(0.5 - m, 0.0, 4.5)) * pixelRatio * step(0.004, k);
  gl_Position = projectionMatrix * mv;
  ${LOGDEPTH.vertex}
}`;

const FRAG = `
${LOGDEPTH.fragmentPars}
uniform float opacity;
varying vec3 vColor;
void main() {
  ${LOGDEPTH.fragment}
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  gl_FragColor = vec4(vColor * opacity * smoothstep(1.0, 0.2, r), 1.0);
}`;

/** The brightness every star keeps however far off it is; the field's glow comes from their numbers. */
const FLOOR = 0.28;

export function createGalacticStars() {
  /** In light-years, J2000 equatorial: one rotation to the ecliptic, one scale to km. */
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  group.matrix.copy(rotation(EQUATORIAL_TO_ECLIPTIC)).multiply(new THREE.Matrix4().makeScale(LY_KM, LY_KM, LY_KM));

  const uniforms = { pixelRatio: { value: 1 }, floorBright: { value: FLOOR }, opacity: { value: 0 } };
  const points = new THREE.Points(new THREE.BufferGeometry(), new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  points.frustumCulled = false;
  points.renderOrder = -1;
  points.visible = false;
  group.add(points);

  let km: AbsolutePositions | null = null;

  function setStars(s: GalacticStars) {
    const col = new Float32Array(s.count * 3);
    for (let i = 0; i < s.count; i++) col.set(starColor(s.bv[i]), i * 3);
    km = new AbsolutePositions(points, s.positions);
    points.geometry.setAttribute('position', km.attribute);
    points.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    points.geometry.setAttribute('absMag', new THREE.BufferAttribute(s.absMag, 1));
    group.updateMatrixWorld(true);
  }

  function update(k: number) {
    uniforms.opacity.value = k;
    uniforms.pixelRatio.value = Math.min(window.devicePixelRatio, 2);
    points.visible = k > 0.005 && !!km;
  }

  return {
    group, setStars, update,
    rebase(origin: THREE.Vector3) { km?.rebase(origin); },
    loaded: () => !!km,
  };
}
