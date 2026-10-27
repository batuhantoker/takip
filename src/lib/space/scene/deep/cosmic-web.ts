import * as THREE from 'three';
import { MLY_KM } from '@/lib/space/deep/cosmos';
import { BASINS } from '@/lib/space/deep/basins.generated';
import { bootesIndex, filamentSegments, nearbyVoidId, type Basin, type BasinFlows, type BasinMesh, type CosmicWeb } from '@/lib/space/deep/cosmic-web';
import { EQUATORIAL_TO_ECLIPTIC } from '@/lib/space/frames';
import { inFront } from '../hud/labels';
import { LOGDEPTH, rotation } from '../shared';

/**
 * The cosmic web (lib/space/deep/cosmic-web.ts): filament spines as faint threads, and the voids named on screen
 * outlined as their fitted ellipsoids, the rim faint where the camera sees the wall edge-on; drawn all at once they
 * were a foam of circles over everything. A void is not drawn from inside, where it would only fog the view. The Cosmicflows-4 basins, Laniakea first, are drawn the same way
 * from their meshes, and from inside too: the Sun is in Laniakea. Through them run the velocity field's streamlines,
 * dashes travelling along each the way matter moves. Millions of light-years, J2000 equatorial, like the cosmos layer.
 */

export const VOID_COLOR = '#A9B3C6';
/**
 * The voids outlined and named at once: the biggest-looking few, once wider than this many pixels, and only while
 * the whole outline fits on screen (radius under this share of its height); one round the camera is only an arc.
 */
const VOID_LABELS = 4, VOID_MIN_PX = 50, VOID_MAX_SCREEN = 0.32;
const LANIAKEA_COLOR = '#FFD38A', BASIN_COLOR = '#D0896A', REPELLER_COLOR = VOID_COLOR;
/** Inside Laniakea its walls would only streak across the nearby voids: the basins come in as the camera gets out of it. */
const BASINS_FROM_MLY = 250, BASINS_FULL_MLY = 900;
export const basinColor = (b: Basin) => (b.id === 'laniakea' ? LANIAKEA_COLOR : b.kind === 'repulsion' ? REPELLER_COLOR : BASIN_COLOR);
const FILAMENT_COLOR = '#E9C9A0';
export const SUPERCLUSTER_COLOR = '#FFC48A';

/** A supercluster as Liivamägi et al. 2012 give it: centre (Mly, equatorial), radius (Mly), galaxies. */
export type Supercluster = [number, number, number, number, number];

// A soft glow facing the camera, as wide as the supercluster; built in view space from the instance's centre and size.
const GLOW_VERT = `
${LOGDEPTH.vertexPars}
uniform float kmPerUnit;
varying vec2 vCorner;
void main() {
  vCorner = position.xy;
  vec4 centre = modelViewMatrix * vec4(instanceMatrix[3].xyz, 1.0);
  gl_Position = projectionMatrix * (centre + vec4(position.xy * length(instanceMatrix[0].xyz) * kmPerUnit, 0.0, 0.0));
  ${LOGDEPTH.vertex}
}`;

const GLOW_FRAG = `
${LOGDEPTH.fragmentPars}
uniform vec3 color;
uniform float opacity;
varying vec2 vCorner;
void main() {
  ${LOGDEPTH.fragment}
  float d = length(vCorner);
  gl_FragColor = vec4(color * opacity * exp(-d * d * 3.5) * (1.0 - smoothstep(0.85, 1.0, d)), 1.0);
}`;

const LINE_VERT = `
${LOGDEPTH.vertexPars}
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  ${LOGDEPTH.vertex}
}`;

const LINE_FRAG = `
${LOGDEPTH.fragmentPars}
uniform vec3 color;
uniform float opacity;
void main() {
  ${LOGDEPTH.fragment}
  gl_FragColor = vec4(color * opacity, 1.0);
}`;

// An affine copy of the unit sphere: its normal is the inverse transpose of the instance matrix on the sphere's normal.
// Worked in the layer's own millions of light-years: squared kilometres this far out overflow a float. The layer's
// matrix only turns and scales evenly, so angles there are the scene's.
const VOID_VERT = `
${LOGDEPTH.vertexPars}
attribute float fade;
uniform vec3 cameraLocal;
uniform float selected;
varying vec3 vNormal;
varying vec3 vView;
varying float vFade;
varying float vPicked;
void main() {
  vPicked = float(gl_InstanceID) == selected ? 1.0 : 0.0;
  vFade = fade;
  vec4 local = instanceMatrix * vec4(position, 1.0);
  vNormal = transpose(inverse(mat3(instanceMatrix))) * normal;
  vView = cameraLocal - local.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * local;
  ${LOGDEPTH.vertex}
}`;

const VOID_FRAG = `
${LOGDEPTH.fragmentPars}
uniform vec3 color;
uniform float opacity;
varying vec3 vNormal;
varying vec3 vView;
varying float vFade;
varying float vPicked;
void main() {
  ${LOGDEPTH.fragment}
  float facing = abs(dot(normalize(vNormal), normalize(vView)));
  // A thin line at the silhouette; a picked void is brighter and faintly filled.
  gl_FragColor = vec4(color * opacity * vFade * (pow(1.0 - facing, 6.0) * (1.0 + vPicked) + vPicked * 0.04), 1.0);
}`;

const BASIN_VERT = `
${LOGDEPTH.vertexPars}
uniform vec3 cameraLocal;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vNormal = normal;
  vView = cameraLocal - position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  ${LOGDEPTH.vertex}
}`;

const BASIN_FRAG = `
${LOGDEPTH.fragmentPars}
uniform vec3 color;
uniform float opacity;
uniform float picked;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  ${LOGDEPTH.fragment}
  float facing = abs(dot(normalize(vNormal), normalize(vView)));
  gl_FragColor = vec4(color * opacity * (pow(1.0 - facing, 3.0) + picked * 0.05), 1.0);
}`;

// Brighter toward the attractor; dashes a fixed distance apart move along at one pace, whatever the line's length.
const FLOW_VERT = `
${LOGDEPTH.vertexPars}
attribute vec3 color;
attribute float along;
attribute float dist;
attribute float basin;
varying vec3 vColor;
varying float vAlong;
varying float vDist;
varying float vBasin;
void main() {
  vColor = color;
  vAlong = along;
  vDist = dist;
  vBasin = basin;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  ${LOGDEPTH.vertex}
}`;

const FLOW_FRAG = `
${LOGDEPTH.fragmentPars}
uniform float opacity;
uniform float time;
uniform float picked;
varying vec3 vColor;
varying float vAlong;
varying float vDist;
varying float vBasin;
void main() {
  ${LOGDEPTH.fragment}
  float head = fract(vDist / 90.0 - time * 0.3);
  float dash = smoothstep(0.0, 0.04, head) * (1.0 - smoothstep(0.04, 0.3, head));
  float pick = picked < 0.0 ? 1.0 : abs(vBasin - picked) < 0.5 ? 2.0 : 0.35;
  gl_FragColor = vec4(vColor * opacity * pick * (0.3 + 0.7 * vAlong) * (0.4 + 1.6 * dash), 1.0);
}`;

const OUTLINES = 8;

/** One InstancedMesh holding the few void outlines shown, refilled each frame from every void's precomputed matrix. */
function outlineSet() {
  const uniforms = { color: { value: new THREE.Color(VOID_COLOR) }, opacity: { value: 0.55 }, cameraLocal: { value: new THREE.Vector3() }, selected: { value: -1 } };
  const geometry = new THREE.SphereGeometry(1, 48, 32);
  const fade = new THREE.InstancedBufferAttribute(new Float32Array(OUTLINES), 1).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('fade', fade);
  const mesh = new THREE.InstancedMesh(geometry, new THREE.ShaderMaterial({
    vertexShader: VOID_VERT, fragmentShader: VOID_FRAG, uniforms, transparent: true, depthWrite: false, side: THREE.FrontSide, blending: THREE.AdditiveBlending,
  }), OUTLINES);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;

  function show(list: { i: number; alpha: number }[], matrices: Float32Array, picked: number, cameraLocal: THREE.Vector3) {
    mesh.count = list.length;
    list.forEach(({ i, alpha }, k) => {
      mesh.instanceMatrix.array.set(matrices.subarray(i * 16, i * 16 + 16), k * 16);
      fade.array[k] = alpha;
    });
    mesh.instanceMatrix.needsUpdate = true;
    fade.needsUpdate = true;
    uniforms.selected.value = list.findIndex(x => x.i === picked);
    uniforms.cameraLocal.value.copy(cameraLocal);
    mesh.visible = list.length > 0;
  }

  return { mesh, show };
}

export function createCosmicWeb() {
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  group.matrix.copy(rotation(EQUATORIAL_TO_ECLIPTIC)).multiply(new THREE.Matrix4().makeScale(MLY_KM, MLY_KM, MLY_KM));

  let web: CosmicWeb | null = null;
  let lines: THREE.LineSegments | null = null;
  const toLocal = new THREE.Matrix4().copy(group.matrix).invert();
  const lineUniforms = { color: { value: new THREE.Color(FILAMENT_COLOR) }, opacity: { value: 0 } };
  const outlines = outlineSet();
  /** Every void's ellipsoid as a matrix on the unit sphere, 16 floats each. */
  let matrices = new Float32Array(0);
  /** The voids named this frame, biggest-looking first, and each outline's fade in or out. */
  let named: { i: number; px: number }[] = [];
  const alphas = new Map<number, number>();
  let lastMs = 0;
  const toCamera = new THREE.Vector3(), forward = new THREE.Vector3(), onScreen = new THREE.Vector3();
  let basinReveal = 0;
  const flowUniforms = { opacity: { value: 0 }, time: { value: 0 }, picked: { value: -1 } };
  let flowLines: THREE.LineSegments | null = null;
  const basins: { mesh: THREE.Mesh; uniforms: { color: { value: THREE.Color }; opacity: { value: number }; picked: { value: number }; cameraLocal: { value: THREE.Vector3 } } }[] = [];
  const glowUniforms = { color: { value: new THREE.Color(SUPERCLUSTER_COLOR) }, opacity: { value: 0 }, kmPerUnit: { value: MLY_KM } };
  let glows: THREE.InstancedMesh | null = null;
  let superclusters: Supercluster[] = [];
  let sclCentres: THREE.Vector3[] = [];

  function setSuperclusters(rows: Supercluster[]) {
    superclusters = rows;
    glows = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, uniforms: glowUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }), rows.length);
    const m = new THREE.Matrix4();
    rows.forEach(([x, y, z, r], i) => glows!.setMatrixAt(i, m.makeScale(r, r, r).setPosition(x, y, z)));
    glows.frustumCulled = false;
    group.add(glows);
    sclCentres = rows.map(([x, y, z]) => new THREE.Vector3(x, y, z).applyMatrix4(group.matrix));
  }
  /** Scene positions, km, and radii of the voids, for labels and picking. */
  let centres: THREE.Vector3[] = [];
  let bootes = -1;

  function setWeb(w: CosmicWeb) {
    web = w;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(filamentSegments(w), 3));
    lines = new THREE.LineSegments(g, new THREE.ShaderMaterial({ vertexShader: LINE_VERT, fragmentShader: LINE_FRAG, uniforms: lineUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    lines.frustumCulled = false;

    matrices = new Float32Array(w.voids.length * 16);
    const m = new THREE.Matrix4();
    w.voids.forEach(({ axes: [a, b, c], centre }, i) => {
      m.set(a[0], b[0], c[0], centre[0], a[1], b[1], c[1], centre[1], a[2], b[2], c[2], centre[2], 0, 0, 0, 1);
      // A left-handed triad would turn the sphere inside out, and FrontSide would then draw it from inside only.
      if (m.determinant() < 0) m.set(a[0], b[0], -c[0], centre[0], a[1], b[1], -c[1], centre[1], a[2], b[2], -c[2], centre[2], 0, 0, 0, 1);
      m.toArray(matrices, i * 16);
    });
    group.add(outlines.mesh, lines);
    group.updateMatrixWorld(true);
    centres = w.voids.map(v => new THREE.Vector3(...v.centre).applyMatrix4(group.matrix));
    bootes = bootesIndex(w.voids);
  }

  function setFlows(flows: BasinFlows) {
    const segs = flows.counts.reduce((n, c) => n + c - 1, 0);
    const pos = new Float32Array(segs * 6), col = new Float32Array(segs * 6), along = new Float32Array(segs * 2), dist = new Float32Array(segs * 2), basin = new Float32Array(segs * 2);
    const tint = new THREE.Color();
    let p = 0, s = 0;
    flows.counts.forEach((c, i) => {
      const b = BASINS[flows.basin[i]];
      tint.set(basinColor(b)).multiplyScalar(b.id === 'laniakea' ? 1 : 0.6);
      const len = [0];
      for (let k = 1; k < c; k++) {
        const a = (p + k - 1) * 3, z = (p + k) * 3;
        len.push(len[k - 1] + Math.hypot(flows.points[z] - flows.points[a], flows.points[z + 1] - flows.points[a + 1], flows.points[z + 2] - flows.points[a + 2]));
      }
      for (let k = 0; k < c - 1; k++, s++) {
        for (const [e, j] of [[0, k], [1, k + 1]]) {
          pos.set(flows.points.subarray((p + j) * 3, (p + j) * 3 + 3), s * 6 + e * 3);
          col.set([tint.r, tint.g, tint.b], s * 6 + e * 3);
          along[s * 2 + e] = len[j] / len[c - 1];
          dist[s * 2 + e] = len[j];
          basin[s * 2 + e] = flows.basin[i];
        }
      }
      p += c;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('along', new THREE.BufferAttribute(along, 1));
    g.setAttribute('dist', new THREE.BufferAttribute(dist, 1));
    g.setAttribute('basin', new THREE.BufferAttribute(basin, 1));
    flowLines = new THREE.LineSegments(g, new THREE.ShaderMaterial({ vertexShader: FLOW_VERT, fragmentShader: FLOW_FRAG, uniforms: flowUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    flowLines.frustumCulled = false;
    group.add(flowLines);
  }

  function setBasins(meshes: BasinMesh[], flows: BasinFlows) {
    setFlows(flows);
    meshes.forEach((m, i) => {
      const b = BASINS[i];
      if (!b) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
      g.setIndex(new THREE.BufferAttribute(m.indices, 1));
      g.computeVertexNormals();
      const uniforms = { color: { value: new THREE.Color(basinColor(b)) }, opacity: { value: 0 }, picked: { value: 0 }, cameraLocal: { value: new THREE.Vector3() } };
      const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
        vertexShader: BASIN_VERT, fragmentShader: BASIN_FRAG, uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      }));
      mesh.frustumCulled = false;
      basins.push({ mesh, uniforms });
      group.add(mesh);
    });
    group.updateMatrixWorld(true);
  }

  /** The voids worth naming from here: in front, not around the camera, wide enough on screen, biggest first. */
  function nameVoids(camera: THREE.PerspectiveCamera, heightPx: number, k: number, farK: number, picked: number) {
    named = [];
    if (!web || (k < 0.3 && farK < 0.3)) return;
    const voids = web.voids;
    const pxPerRad = heightPx / 2 / Math.tan((camera.fov * Math.PI) / 360);
    camera.getWorldDirection(forward);
    const seen: { i: number; px: number }[] = [];
    voids.forEach((v, i) => {
      if ((v.catalogue === 'quaia' ? farK : k) < 0.3) return;
      const c = centres[i], r = v.reffMly * MLY_KM, d = toCamera.subVectors(c, camera.position).length();
      if (d < r || !inFront(camera, c, forward)) return;
      // Centred off screen, its outline and name would be too.
      onScreen.copy(c).project(camera);
      if (Math.abs(onScreen.x) > 0.9 || Math.abs(onScreen.y) > 0.9) return;
      const px = (r / d) * pxPerRad;
      if ((px > VOID_MIN_PX && px < VOID_MAX_SCREEN * heightPx) || i === picked) seen.push({ i, px });
    });
    seen.sort((a, b) => b.px - a.px);
    named = seen.filter((x, n) => n < VOID_LABELS || x.i === picked);
  }

  /** Outlines ease in and out as voids join and leave the named few. */
  function fadeOutlines(picked: number, k: number, farK: number, cam: THREE.Vector3) {
    const now = performance.now(), step = Math.min(1, (now - lastMs) / 300);
    lastMs = now;
    const wanted = new Set(named.map(x => x.i));
    for (const i of new Set([...alphas.keys(), ...wanted])) {
      const a = Math.min(1, Math.max(0, (alphas.get(i) ?? 0) + (wanted.has(i) ? step : -step)));
      if (a > 0) alphas.set(i, a);
      else alphas.delete(i);
    }
    const voids = web?.voids ?? [];
    const list = [...alphas].map(([i, a]) => ({ i, alpha: a * (voids[i]?.catalogue === 'quaia' ? farK : k) })).sort((x, y) => y.alpha - x.alpha).slice(0, OUTLINES);
    outlines.show(list, matrices, picked, cam);
  }

  /**
   * `k` fades the near web, `farK` the supervoids; far out the threads crowd into a blot, so they thin with
   * distance as the galaxies do. `pickedId` is the selected feature's id: a void (`void:<i>`) or a basin lights up.
   */
  /** The void a selected feature is: a catalogued one by index, Boötes, or one of the nearest by its name. */
  function voidIndexOf(id: string | null): number {
    if (!id || !web) return -1;
    if (id.startsWith('void:')) return Number(id.slice(5));
    if (id === 'bootes-void') return bootes;
    return web.voids.findIndex(v => v.nearby !== undefined && nearbyVoidId(v.nearby) === id);
  }

  function update(k: number, farK: number, sunKm: number, camera: THREE.PerspectiveCamera, heightPx: number, pickedId: string | null = null) {
    const picked = voidIndexOf(pickedId);
    const crowd = Math.min(1, Math.max(0.15, (1_500 * MLY_KM) / Math.max(sunKm, 1)));
    lineUniforms.opacity.value = 0.22 * k * crowd;
    if (lines) lines.visible = k > 0.005;
    const cam = camera.position.clone().applyMatrix4(toLocal);
    nameVoids(camera, heightPx, k, farK, picked);
    fadeOutlines(picked, k, farK, cam);
    glowUniforms.opacity.value = 0.09 * k;
    basinReveal = THREE.MathUtils.smoothstep(sunKm / MLY_KM, BASINS_FROM_MLY, BASINS_FULL_MLY);
    const pickedIndex = BASINS.findIndex(x => x.id === pickedId);
    basins.forEach(({ mesh, uniforms }, i) => {
      const b = BASINS[i], on = b.id === pickedId;
      uniforms.opacity.value = k * (b.id === 'laniakea' ? 0.34 : 0.12) * (on ? 2 : (pickedIndex >= 0 ? 0.5 : 1) * basinReveal);
      uniforms.picked.value = on ? 1 : 0;
      uniforms.cameraLocal.value.copy(cam);
      mesh.visible = uniforms.opacity.value > 0.002;
    });
    flowUniforms.opacity.value = k * 0.5 * (pickedIndex >= 0 ? 1 : basinReveal);
    flowUniforms.picked.value = pickedIndex;
    flowUniforms.time.value = performance.now() / 1000;
    if (flowLines) flowLines.visible = flowUniforms.opacity.value > 0.002;
    group.visible = (k > 0.005 || farK > 0.005) && !!web;
  }

  return {
    group, setWeb, setSuperclusters, setBasins, update,
    loaded: () => !!web,
    basinsLoaded: () => basins.length > 0,
    /** How far the basins have come in, 0–1. */
    basinReveal: () => basinReveal,
    superclustersLoaded: () => !!glows,
    superclusters: () => superclusters,
    superclusterCentre: (i: number) => sclCentres[i],
    superclusterRadiusKm: (i: number) => (superclusters[i]?.[3] ?? 0) * MLY_KM,
    voids: () => web?.voids ?? [],
    /** The voids named on screen this frame, with their size in pixels; the picked one among them. */
    namedVoids: () => named,
    /** Scene position of void i, km. */
    voidCentre: (i: number) => centres[i],
    voidRadiusKm: (i: number) => (web?.voids[i].reffMly ?? 0) * MLY_KM,
    bootes: () => bootes,
  };
}
