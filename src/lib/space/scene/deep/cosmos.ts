import * as THREE from 'three';
import { t } from '@/lib/core/i18n/active';
import { distinctStructures, fillZoneOfAvoidance, MLY_KM, parseRecords, RECORD_FLOATS, type CosmosMeta } from '@/lib/space/deep/cosmos';
import { structureByName } from '@/lib/space/deep/structures';
import { bodyDirection, EQUATORIAL_TO_ECLIPTIC } from '@/lib/space/frames';
import { LOGDEPTH, loadTexture, rotation } from '../shared';

/**
 * Out to the edge of the observable universe: the 2MASS galaxies around the
 * Local Group, SDSS galaxies and quasars tracing the cosmic web, and the
 * cosmic microwave background on the last-scattering surface. Everything is
 * held in millions of light-years, J2000 equatorial, and placed by one matrix.
 */

const CMB_URL = '/data/cosmos/cmb.jpg';
/** Out to this the galaxy points keep full brightness. */
const FULL_BRIGHT_MLY = 4_000;

const POINT_VERT = `
${LOGDEPTH.vertexPars}
attribute vec3 color;
uniform float pixelRatio;
uniform float size;
varying vec3 vColor;
void main() {
  vColor = color;
  gl_PointSize = size * pixelRatio;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  ${LOGDEPTH.vertex}
}`;

const POINT_FRAG = `
${LOGDEPTH.fragmentPars}
uniform float opacity;
varying vec3 vColor;
void main() {
  ${LOGDEPTH.fragment}
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  gl_FragColor = vec4(vColor * opacity * smoothstep(1.0, 0.2, r), 1.0);
}`;

/**
 * The CMB map shares the Milky Way sky's convention: u = 0.5 − RA/360, top row Dec +90°. The shell is two meshes:
 * its inside (the whole sky from within, the far half from without) drawn before the galaxies, and from without its
 * near half after them, as glass, clear in the middle and solid at the rim. One mesh drawn from both sides painted
 * whichever half its triangles reached last, so the shell changed as the camera turned. Worked in the layer's own
 * millions of light-years: squared kilometres this far out overflow a float.
 */
const CMB_VERT = `
${LOGDEPTH.vertexPars}
uniform vec3 cameraLocal;
varying vec3 vDir;
varying vec3 vView;
void main() {
  vDir = position;
  vView = cameraLocal - position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  ${LOGDEPTH.vertex}
}`;

const CMB_FRAG = `
${LOGDEPTH.fragmentPars}
uniform sampler2D map;
uniform float opacity;
uniform float saturation;
uniform float glass;
varying vec3 vDir;
varying vec3 vView;
void main() {
  ${LOGDEPTH.fragment}
  vec3 d = normalize(vDir);
  float ra = degrees(atan(d.y, d.x));
  float dec = degrees(asin(clamp(d.z, -1.0, 1.0)));
  vec2 uv = vec2(fract(0.5 - ra / 360.0), 0.5 + dec / 180.0);
  // fract() jumps where RA wraps, which would pick the smallest mip there: take the gradient from a copy wrapping elsewhere.
  vec2 uv2 = vec2(fract(uv.x + 0.5), uv.y);
  vec2 dx = dFdx(uv), dy = dFdy(uv), dx2 = dFdx(uv2), dy2 = dFdy(uv2);
  if (dot(dx2, dx2) + dot(dy2, dy2) < dot(dx, dx) + dot(dy, dy)) { dx = dx2; dy = dy2; }
  vec3 c = textureGrad(map, uv, dx, dy).rgb;
  c = mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, saturation);
  float rim = 1.0 - abs(dot(d, normalize(vView)));
  gl_FragColor = glass > 0.5 ? vec4(c, opacity * (0.1 + 0.9 * rim * rim)) : vec4(c * opacity, 1.0);
  #include <colorspace_fragment>
}`;

function pointCloud(records: Float32Array, colour: (value: number, i: number) => [number, number, number], size: number) {
  const n = records.length / RECORD_FLOATS;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos.set(records.subarray(i * RECORD_FLOATS, i * RECORD_FLOATS + 3), i * 3);
    col.set(colour(records[i * RECORD_FLOATS + 3], i), i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const uniforms = { pixelRatio: { value: 1 }, size: { value: size }, opacity: { value: 0 } };
  const points = new THREE.Points(geometry, new THREE.ShaderMaterial({ vertexShader: POINT_VERT, fragmentShader: POINT_FRAG, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  points.frustumCulled = false;
  return { points, uniforms };
}

/** Brighter galaxies (absolute Ks) whiter and stronger; the faint ones a dim blue-grey. */
function localColour(absK: number): [number, number, number] {
  const k = Math.min(1, Math.max(0.15, (-19 - absK) / 6));
  return [0.55 + 0.45 * k, 0.6 + 0.35 * k, 0.75 + 0.2 * k].map(c => c * (0.35 + 0.65 * k)) as [number, number, number];
}

/** The Zone of Avoidance's stand-in galaxies: the same colours, dimmer and a little blue, so they read as drawn in. */
function zoaColour(absK: number): [number, number, number] {
  const [r, g, b] = localColour(absK);
  return [r * 0.45, g * 0.5, b * 0.65];
}

/** Galaxies a warm white, fading with redshift; quasars (stored with negative redshift) violet. */
function deepColour(z: number): [number, number, number] {
  if (z < 0) return [0.55, 0.45, 0.95];
  const k = 1 - Math.min(0.6, z);
  return [0.9 * k, 0.85 * k, 0.75 * k];
}

export function createCosmos() {
  /** In millions of light-years, J2000 equatorial. */
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  group.matrix.copy(rotation(EQUATORIAL_TO_ECLIPTIC)).multiply(new THREE.Matrix4().makeScale(MLY_KM, MLY_KM, MLY_KM));

  let meta: CosmosMeta | null = null;
  let local: ReturnType<typeof pointCloud> | null = null;
  let deep: ReturnType<typeof pointCloud> | null = null;
  let zoa: ReturnType<typeof pointCloud> | null = null;
  const cmbUniforms = { map: { value: null as THREE.Texture | null }, opacity: { value: 0 }, saturation: { value: 1 }, cameraLocal: { value: new THREE.Vector3() } };
  const toLocal = new THREE.Matrix4().copy(group.matrix).invert();
  let cmb: THREE.Mesh[] = [];
  let cmbLoading = false;

  function setMeta(m: CosmosMeta) {
    meta = m;
    const sphere = new THREE.SphereGeometry(m.horizon.cmbMly, 128, 64);
    cmb = ([[THREE.BackSide, 0, -3], [THREE.FrontSide, 1, 3]] as const).map(([side, glass, order]) => {
      const mesh = new THREE.Mesh(sphere, new THREE.ShaderMaterial({
        vertexShader: CMB_VERT, fragmentShader: CMB_FRAG, uniforms: { ...cmbUniforms, glass: { value: glass } }, side, transparent: true, depthWrite: false,
      }));
      mesh.frustumCulled = false;
      mesh.renderOrder = order;
      return mesh;
    });
    group.add(...cmb);
  }

  function setLocal(buf: ArrayBuffer) {
    const records = parseRecords(buf);
    local = pointCloud(records, localColour, 2.2);
    zoa = pointCloud(fillZoneOfAvoidance(records), zoaColour, 2.2);
    group.add(local.points, zoa.points);
  }

  function setDeep(buf: ArrayBuffer) {
    deep = pointCloud(parseRecords(buf), deepColour, 1.3);
    group.add(deep.points);
  }

  /**
   * Each layer's fade; the CMB's texture loads the first time it is wanted.
   * From far outside, hundreds of thousands of additive points pile into one
   * white blot, so they dim as the camera pulls away.
   */
  function update(localK: number, deepK: number, cmbK: number, sunKm: number, camera: THREE.Camera, illustrations: boolean) {
    const pr = Math.min(window.devicePixelRatio, 2);
    // Seen from outside the shell, the galaxies inside are a few pixels: at full strength they burnt into a white blot.
    const crowd = Math.min(1, Math.max(0.03, (FULL_BRIGHT_MLY * MLY_KM) / Math.max(sunKm, 1)));
    for (const [layer, k] of [[local, localK], [deep, deepK], [zoa, illustrations ? localK : 0]] as const) {
      if (!layer) continue;
      layer.uniforms.opacity.value = k * crowd;
      layer.uniforms.pixelRatio.value = pr;
      layer.points.visible = k > 0.005;
    }
    if (cmbK > 0 && !cmbLoading) {
      cmbLoading = true;
      loadTexture(CMB_URL, tex => { cmbUniforms.map.value = tex; });
    }
    // From inside it wraps the whole sky, so it waits until the camera nears the shell, or it would hide the quasars
    // and supervoids in front of it; from outside, a ball the whole view, it steps back so it doesn't shout.
    const shell = meta ? sunKm / (meta.horizon.cmbMly * MLY_KM) : 0;
    const near = THREE.MathUtils.smoothstep(shell, 0.45, 0.97), outside = THREE.MathUtils.smoothstep(shell, 0.97, 1.6);
    cmbUniforms.opacity.value = 0.75 * cmbK * (shell < 0.97 ? near : 1) * (1 - 0.45 * outside);
    cmbUniforms.saturation.value = (0.55 + 0.45 * near) * (1 - 0.35 * outside);
    cmbUniforms.cameraLocal.value.copy(camera.position).applyMatrix4(toLocal);
    for (const mesh of cmb) mesh.visible = cmbK > 0.005 && !!cmbUniforms.map.value;
  }

  /** Label anchors in scene km: the named structures, and the CMB's own. */
  function labels(): { id: string; name: string; position: THREE.Vector3 }[] {
    if (!meta) return [];
    const at = (ra: number, dec: number, mly: number) => new THREE.Vector3(...bodyDirection(dec, ra).map(v => v * mly)).applyMatrix4(group.matrix);
    return [
      ...distinctStructures(meta.structures).flatMap(s => {
        const known = structureByName(s.name);
        return known ? [{ id: known.id, name: t(known.title), position: at(s.ra, s.dec, s.mly) }] : [];
      }),
      { id: 'cmb', name: t('Cosmic microwave background'), position: at(0, 75, meta.horizon.cmbMly) },
    ];
  }

  return { group, setMeta, setLocal, setDeep, update, labels, meta: () => meta, loaded: () => ({ local: !!local, deep: !!deep }) };
}
