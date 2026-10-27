import * as THREE from 'three';
import { DEEP_SKY_PLACED, deepSkyUrl, type DeepSkyKind } from '@/lib/space/deep/deep-sky';
import { LOGDEPTH, loadTexture, v3 } from '../shared';

/**
 * The deep-sky photographs (lib/space/deep/deep-sky.ts), each a flat sheet at its object's place, face to the
 * Sun. Sheets are drawn with max blending, so pictures that overlap (the Pillars inside the Eagle) never add up
 * and their dark skies never darken what lies behind. A texture loads once its sheet is big enough on screen
 * and is let go when the sheet shrinks away again.
 */

export const KIND_COLOR: Record<DeepSkyKind, string> = {
  nebula: '#F2A6C8', remnant: '#8FD3FF', cluster: '#FFE3A3', galaxy: '#C9CFFF', 'black-hole': '#FFB36B', 'deep-field': '#E6D9FF',
};

/** On-screen size, px, over which a sheet fades in; below LOAD_PX its texture is not wanted. */
const SHOW_PX = [14, 60] as const;
const LOAD_PX = 10, DROP_PX = 3;
/** Above this many pixels the full picture replaces the 512 px one, and below DOWN_PX it goes back: a 2048 px texture is 22 MB. */
const FULL_PX = 480, DOWN_PX = 320;
/** Screen heights over which a sheet fades out as the camera closes in: past that it is a blur, or a frame round a sharper one. */
const OVERSIZE = [1.6, 3.5] as const;

const VERT = `
${LOGDEPTH.vertexPars}
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  ${LOGDEPTH.vertex}
}`;

// The sky around an object is never quite black: the floor is lifted and the edges feathered, corners rounded, so no sheet shows its frame.
const FRAG = `
${LOGDEPTH.fragmentPars}
uniform sampler2D map;
uniform float opacity;
varying vec2 vUv;
void main() {
  ${LOGDEPTH.fragment}
  vec2 q = abs(vUv - 0.5) * 2.0;
  float edge = 1.0 - smoothstep(0.78, 1.0, pow(pow(q.x, 4.0) + pow(q.y, 4.0), 0.25));
  vec3 c = max(texture2D(map, vUv).rgb - 0.004, 0.0) / 0.996;
  gl_FragColor = vec4(c * opacity * edge, 1.0);
  #include <colorspace_fragment>
}`;

const DOT_VERT = `
${LOGDEPTH.vertexPars}
attribute vec3 color;
attribute float alpha;
uniform float pixelRatio;
varying vec4 vColor;
void main() {
  vColor = vec4(color, alpha);
  gl_PointSize = 6.0 * pixelRatio * step(0.004, alpha);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  ${LOGDEPTH.vertex}
}`;

const DOT_FRAG = `
${LOGDEPTH.fragmentPars}
varying vec4 vColor;
void main() {
  ${LOGDEPTH.fragment}
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  gl_FragColor = vec4(vColor.rgb * vColor.a * smoothstep(1.0, 0.3, r), 1.0);
}`;

interface Sheet {
  id: string;
  mesh: THREE.Mesh;
  uniforms: { map: { value: THREE.Texture | null }; opacity: { value: number } };
  centre: THREE.Vector3;
  /** Unit vector from the picture back toward the Sun: the side it is seen from. */
  face: THREE.Vector3;
  sizeKm: number;
  /** What is shown: nothing, the 512 px rendition or the full picture; and what is on its way, if anything. */
  tier: 0 | 1 | 2;
  loading: 1 | 2 | null;
}

function sheetGeometry(corners: THREE.Vector3[], centre: THREE.Vector3): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(corners.flatMap(c => c.clone().sub(centre).toArray())), 3));
  // Corners run top-left, top-right, bottom-right, bottom-left; textures load with v up.
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]), 2));
  g.setIndex([0, 3, 2, 0, 2, 1]);
  return g;
}

export function createDeepSky() {
  const group = new THREE.Group();
  const sheets: Sheet[] = DEEP_SKY_PLACED.map(({ object, place }) => {
    const centre = v3(place.centre);
    const uniforms = { map: { value: null as THREE.Texture | null }, opacity: { value: 0 } };
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    });
    const mesh = new THREE.Mesh(sheetGeometry(place.corners.map(c => v3(c)), centre), material);
    mesh.position.copy(centre);
    mesh.frustumCulled = false;
    mesh.visible = false;
    group.add(mesh);
    return { id: object.id, mesh, uniforms, centre, face: v3(place.normal).negate(), sizeKm: Math.max(place.widthKm, place.heightKm), tier: 0, loading: null };
  });

  const alpha = new Float32Array(sheets.length);
  const dotGeometry = new THREE.BufferGeometry();
  dotGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sheets.flatMap(s => s.centre.toArray())), 3));
  dotGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(DEEP_SKY_PLACED.flatMap(d => new THREE.Color(KIND_COLOR[d.object.kind]).toArray())), 3));
  const alphaAttr = new THREE.BufferAttribute(alpha, 1);
  dotGeometry.setAttribute('alpha', alphaAttr);
  const dotUniforms = { pixelRatio: { value: 1 } };
  const dots = new THREE.Points(dotGeometry, new THREE.ShaderMaterial({ vertexShader: DOT_VERT, fragmentShader: DOT_FRAG, uniforms: dotUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  dots.frustumCulled = false;
  group.add(dots);

  const toCam = new THREE.Vector3();
  /** On-screen size of each sheet last frame, px. */
  const px = new Float32Array(sheets.length);
  const index = new Map(sheets.map((s, i) => [s.id, i]));

  /** The shown rendition stays up until the wanted one has arrived. */
  function want(s: Sheet, tier: 0 | 1 | 2) {
    if (tier === 0) {
      s.uniforms.map.value?.dispose();
      s.uniforms.map.value = null;
      s.tier = 0;
      s.loading = null;
      return;
    }
    s.loading = tier;
    loadTexture(deepSkyUrl(s.id, tier === 1), t => {
      if (s.loading !== tier) { t.dispose(); return; }
      s.uniforms.map.value?.dispose();
      s.uniforms.map.value = t;
      s.tier = tier;
      s.loading = null;
    });
  }

  /**
   * `fade(i)` is how much the tiers want object i at all; `dotFade(i)` its marker's. Sheets fade in with their
   * size on screen and out as the camera swings round to their edge or back.
   */
  function update(camera: THREE.PerspectiveCamera, heightPx: number, fade: (i: number) => number, dotFade: (i: number) => number) {
    const pxPerRad = heightPx / 2 / Math.tan((camera.fov * Math.PI) / 360);
    let anyDot = false;
    sheets.forEach((s, i) => {
      toCam.subVectors(camera.position, s.centre);
      const d = toCam.length();
      px[i] = (s.sizeKm / Math.max(d, 1)) * pxPerRad;
      const k = fade(i);
      const facing = THREE.MathUtils.smoothstep(toCam.dot(s.face) / d, 0.08, 0.4);
      const shown = k * facing * THREE.MathUtils.smoothstep(px[i], SHOW_PX[0], SHOW_PX[1]) * (1 - THREE.MathUtils.smoothstep(px[i] / heightPx, OVERSIZE[0], OVERSIZE[1]));
      const tier = k === 0 || px[i] < DROP_PX ? 0 : px[i] > FULL_PX ? 2 : s.tier === 2 && px[i] < DOWN_PX ? 1 : s.tier === 0 && px[i] > LOAD_PX ? 1 : s.tier;
      if (tier !== s.tier && tier !== s.loading) want(s, tier);
      s.uniforms.opacity.value = 0.92 * shown;
      s.mesh.visible = shown > 0.004 && s.tier > 0;
      // The marker stands in until the picture itself can be seen.
      alpha[i] = dotFade(i) * (1 - THREE.MathUtils.smoothstep(px[i], 4, SHOW_PX[1]));
      anyDot ||= alpha[i] > 0.004;
    });
    alphaAttr.needsUpdate = true;
    dotUniforms.pixelRatio.value = Math.min(window.devicePixelRatio, 2);
    dots.visible = anyDot;
  }

  return {
    group, update,
    /** Scene position of object i's picture, km. */
    centre: (i: number) => sheets[i].centre,
    sizePx: (i: number) => px[i],
    sizeKm: (i: number) => sheets[i].sizeKm,
    /** How much of the picture of `id` is showing, 0–1, as of the last frame. */
    shown: (id: string) => {
      const i = index.get(id);
      return i === undefined || !sheets[i].mesh.visible ? 0 : sheets[i].uniforms.opacity.value / 0.92;
    },
  };
}
