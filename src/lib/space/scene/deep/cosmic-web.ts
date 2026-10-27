import * as THREE from 'three';
import { MLY_KM } from '@/lib/space/deep/cosmos';
import { BASINS } from '@/lib/space/deep/basins.generated';
import { bootesIndex, filamentSegments, type Basin, type BasinFlows, type BasinMesh, type CosmicVoid, type CosmicWeb, type VoidCatalogue } from '@/lib/space/deep/cosmic-web';
import { EQUATORIAL_TO_ECLIPTIC } from '@/lib/space/frames';
import { LOGDEPTH, rotation } from '../shared';

/**
 * The cosmic web (lib/space/deep/cosmic-web.ts): filament spines as faint threads, and each void as its fitted
 * ellipsoid, drawn as a bubble whose rim glows where the camera sees its wall edge-on. A void is not drawn
 * from inside, where it would only fog the view. The Cosmicflows-4 basins, Laniakea first, are drawn the same way
 * from their meshes, and from inside too: the Sun is in Laniakea. Through them run the velocity field's streamlines,
 * dashes travelling along each the way matter moves. Millions of light-years, J2000 equatorial, like the cosmos layer.
 */

export const VOID_COLOR: Record<VoidCatalogue, string> = { sdss: '#7F9CFF', network: '#A99BFF', quaia: '#8C7BFF', local: '#8FC8FF' };
const LANIAKEA_COLOR = '#FFD38A', BASIN_COLOR = '#D0896A', REPELLER_COLOR = '#93A6FF';
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
// matrix only turns and scales evenly, so angles there are the scene's. Voids fill most of space, so each is drawn
// as a soft rim only: together they read as the foam they are.
const VOID_VERT = `
${LOGDEPTH.vertexPars}
uniform vec3 cameraLocal;
uniform float selected;
varying vec3 vNormal;
varying vec3 vView;
varying float vFade;
varying float vPicked;
varying vec3 vTint;
void main() {
  vPicked = float(gl_InstanceID) == selected ? 1.0 : 0.0;
  vTint = instanceColor;
  vec4 local = instanceMatrix * vec4(position, 1.0);
  vNormal = transpose(inverse(mat3(instanceMatrix))) * normal;
  vView = cameraLocal - local.xyz;
  // Too small on screen, a rim is only speckle.
  float across = length(instanceMatrix[0].xyz) / max(length(cameraLocal - instanceMatrix[3].xyz), 1e-3);
  vFade = smoothstep(0.012, 0.05, across);
  gl_Position = projectionMatrix * modelViewMatrix * local;
  ${LOGDEPTH.vertex}
}`;

const VOID_FRAG = `
${LOGDEPTH.fragmentPars}
uniform float opacity;
varying vec3 vNormal;
varying vec3 vView;
uniform float selected;
varying float vFade;
varying float vPicked;
varying vec3 vTint;
void main() {
  ${LOGDEPTH.fragment}
  float facing = abs(dot(normalize(vNormal), normalize(vView)));
  // A picked void stands out, faintly filled; the rest step back.
  float k = selected < 0.0 ? 1.0 : mix(0.45, 3.0, vPicked);
  gl_FragColor = vec4(vTint * opacity * k * (vFade * pow(1.0 - facing, 4.0) + vPicked * 0.05), 1.0);
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

/** One InstancedMesh of void bubbles, for the voids `keep` picks; instance k is void `ids[k]`. */
function bubbleSet() {
  const uniforms = { opacity: { value: 0 }, cameraLocal: { value: new THREE.Vector3() }, selected: { value: -1 } };
  let mesh: THREE.InstancedMesh | null = null;
  let ids: number[] = [];

  function build(voids: CosmicVoid[], keep: (v: CosmicVoid) => boolean): THREE.InstancedMesh {
    ids = voids.flatMap((v, i) => (keep(v) ? [i] : []));
    mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 32, 20), new THREE.ShaderMaterial({
      vertexShader: VOID_VERT, fragmentShader: VOID_FRAG, uniforms, transparent: true, depthWrite: false, side: THREE.FrontSide, blending: THREE.AdditiveBlending,
    }), ids.length);
    const m = new THREE.Matrix4(), tint = new THREE.Color();
    ids.forEach((id, k) => {
      const v = voids[id];
      const [a, b, c] = v.axes;
      m.set(a[0], b[0], c[0], v.centre[0], a[1], b[1], c[1], v.centre[1], a[2], b[2], c[2], v.centre[2], 0, 0, 0, 1);
      // A left-handed triad would turn the sphere inside out, and FrontSide would then draw it from inside only.
      if (m.determinant() < 0) m.set(a[0], b[0], -c[0], v.centre[0], a[1], b[1], -c[1], v.centre[1], a[2], b[2], -c[2], v.centre[2], 0, 0, 0, 1);
      mesh!.setMatrixAt(k, m);
      mesh!.setColorAt(k, tint.set(VOID_COLOR[v.catalogue]));
    });
    mesh.frustumCulled = false;
    return mesh;
  }

  function update(opacity: number, cameraLocal: THREE.Vector3, picked: number) {
    uniforms.opacity.value = opacity;
    uniforms.cameraLocal.value.copy(cameraLocal);
    uniforms.selected.value = picked < 0 ? -1 : ids.indexOf(picked);
    if (mesh) mesh.visible = opacity > 0.002;
  }

  return { build, update };
}

export function createCosmicWeb() {
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  group.matrix.copy(rotation(EQUATORIAL_TO_ECLIPTIC)).multiply(new THREE.Matrix4().makeScale(MLY_KM, MLY_KM, MLY_KM));

  let web: CosmicWeb | null = null;
  let lines: THREE.LineSegments | null = null;
  const toLocal = new THREE.Matrix4().copy(group.matrix).invert();
  const lineUniforms = { color: { value: new THREE.Color(FILAMENT_COLOR) }, opacity: { value: 0 } };
  /** Near voids (SDSS, the all-sky network, the nearest) and the far supervoids fade in at their own scales. */
  const near = bubbleSet(), far = bubbleSet();
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

    group.add(near.build(w.voids, v => v.catalogue !== 'quaia'), far.build(w.voids, v => v.catalogue === 'quaia'), lines);
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

  /**
   * `k` fades the near web, `farK` the supervoids; far out the threads crowd into a blot, so they thin with
   * distance as the galaxies do. `picked` is the selected void's index, or −1.
   */
  /** `pickedId` is the selected feature's id: a void (`void:<i>`) or a basin lights up when picked. */
  function update(k: number, farK: number, sunKm: number, camera: THREE.Camera, pickedId: string | null = null) {
    const picked = pickedId?.startsWith('void:') ? Number(pickedId.slice(5)) : -1;
    const crowd = Math.min(1, Math.max(0.15, (1_500 * MLY_KM) / Math.max(sunKm, 1)));
    lineUniforms.opacity.value = 0.22 * k * crowd;
    if (lines) lines.visible = k > 0.005;
    const cam = camera.position.clone().applyMatrix4(toLocal);
    near.update(0.22 * k, cam, picked);
    glowUniforms.opacity.value = 0.09 * k;
    far.update(0.2 * farK, cam, picked);
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
    /** Scene position of void i, km. */
    voidCentre: (i: number) => centres[i],
    voidRadiusKm: (i: number) => (web?.voids[i].reffMly ?? 0) * MLY_KM,
    bootes: () => bootes,
  };
}
