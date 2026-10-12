import * as THREE from 'three';
import { bodyPoint } from '@/lib/space/frames';
import { bodyGeometry, dotTexture, loadTexture, LOGDEPTH } from './shared';

/**
 * Earth in the space view: NASA Blue Marble by day and Black Marble city
 * lights by night, split by the real Sun direction, with the satellite
 * catalogue drawn at its true altitude in the same Earth-fixed frame.
 */

export const EARTH_RADIUS_KM = 6371;

const VERT = `
${LOGDEPTH.vertexPars}
varying vec2 vUv;
varying vec3 vNormalW;
void main() {
  vUv = uv;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  ${LOGDEPTH.vertex}
}`;

const FRAG = `
${LOGDEPTH.fragmentPars}
uniform sampler2D dayMap;
uniform sampler2D nightMap;
uniform vec3 sunDir;
varying vec2 vUv;
varying vec3 vNormalW;
void main() {
  ${LOGDEPTH.fragment}
  float ndl = dot(normalize(vNormalW), sunDir);
  vec3 day = texture2D(dayMap, vUv).rgb * (0.05 + 1.15 * max(ndl, 0.0));
  // Black Marble's dim blue land would read as a lit Earth; only the city lights carry over.
  vec3 night = texture2D(nightMap, vUv).rgb;
  float glow = smoothstep(0.18, 0.6, max(night.r, max(night.g, night.b)));
  vec3 lights = night * glow * 1.8;
  float daylight = smoothstep(-0.12, 0.1, ndl);
  gl_FragColor = vec4(mix(lights, day, daylight), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// View space throughout: world coordinates are ~1.5e8 km, too large for float32 on the GPU.
const ATMO_VERT = `
${LOGDEPTH.vertexPars}
uniform vec3 sunDir;
varying vec3 vNormalV;
varying vec3 vViewV;
varying vec3 vSunV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vViewV = normalize(-mv.xyz);
  vSunV = normalize((viewMatrix * vec4(sunDir, 0.0)).xyz);
  gl_Position = projectionMatrix * mv;
  ${LOGDEPTH.vertex}
}`;

const ATMO_FRAG = `
${LOGDEPTH.fragmentPars}
varying vec3 vNormalV;
varying vec3 vViewV;
varying vec3 vSunV;
void main() {
  ${LOGDEPTH.fragment}
  float rim = pow(1.0 - max(dot(vNormalV, vViewV), 0.0), 4.0);
  float lit = smoothstep(-0.25, 0.4, dot(vNormalV, vSunV));
  gl_FragColor = vec4(vec3(0.35, 0.62, 1.0) * rim * lit * 1.4, 1.0);
}`;

export interface SatellitePoint { lat: number; lng: number; alt: number; color?: string }

export function createEarth() {
  /** Earth-fixed: its rotation is set every frame from sidereal time. */
  const spin = new THREE.Group();
  const sunDir = { value: new THREE.Vector3(1, 0, 0) };
  const placeholder = new THREE.DataTexture(new Uint8Array([8, 16, 40, 255]), 1, 1);
  placeholder.needsUpdate = true;
  const uniforms = { dayMap: { value: placeholder as THREE.Texture }, nightMap: { value: placeholder as THREE.Texture }, sunDir };
  const surface = new THREE.Mesh(bodyGeometry(EARTH_RADIUS_KM, 128), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms }));
  spin.add(surface);
  loadTexture('/api/space/texture/earth', t => { uniforms.dayMap.value = t; });
  loadTexture('/api/space/texture/earth-night', t => { uniforms.nightMap.value = t; });

  // The atmosphere does not turn with the ground, but nothing here would show it.
  const atmosphere = new THREE.Mesh(
    bodyGeometry(EARTH_RADIUS_KM * 1.018, 96),
    new THREE.ShaderMaterial({ vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG, uniforms: { sunDir }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  spin.add(atmosphere);

  const satGeometry = new THREE.BufferGeometry();
  const satellites = new THREE.Points(satGeometry, new THREE.PointsMaterial({
    size: 3, sizeAttenuation: false, vertexColors: true, map: dotTexture(32), transparent: true, depthWrite: false, alphaTest: 0.05,
  }));
  satellites.frustumCulled = false;
  spin.add(satellites);

  function setSatellites(rows: SatellitePoint[]) {
    const pos = new Float32Array(rows.length * 3);
    const col = new Float32Array(rows.length * 3);
    const c = new THREE.Color();
    rows.forEach((r, i) => {
      const p = bodyPoint(r.lat, r.lng, r.alt, EARTH_RADIUS_KM);
      pos.set(p, i * 3);
      c.set(/^#[0-9a-f]{6}$/i.test(r.color ?? '') ? r.color! : '#00e5ff');
      col.set([c.r, c.g, c.b], i * 3);
    });
    satGeometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    satGeometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    satGeometry.computeBoundingSphere();
  }

  return { spin, surface, satellites, sunDir: sunDir.value, setSatellites };
}
