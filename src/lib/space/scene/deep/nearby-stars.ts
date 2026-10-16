import * as THREE from 'three';
import { LY_KM } from '@/lib/space/astro';
import type { ExoHost } from '@/lib/space/deep/exoplanets';
import { bodyDirection, EQUATORIAL_TO_ECLIPTIC } from '@/lib/space/frames';
import { absoluteMag, starLy, SUN_ABS_MAG, type NearbyStarCatalog } from '@/lib/space/deep/nearby-stars';
import { starColor } from '@/lib/space/globe/sky-projection';
import { AbsolutePositions } from '../floating-origin';
import { LOGDEPTH, rotation } from '../shared';

/**
 * The stars as real 3D points, in light-years. Each star's brightness is
 * worked out from where the camera is, so from the Sun the sky is the one
 * everyone knows and away from it the near stars swell and the figures come
 * apart. The Sun is one of the points. Exoplanet hosts get a ring.
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
  float k = clamp(1.15 - 0.17 * m, floorBright, 1.0);
  vColor = color * k;
  gl_PointSize = (2.4 + clamp(1.0 - m, 0.0, 6.0)) * pixelRatio * step(0.004, k);
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
  gl_FragColor = vec4(vColor * opacity * smoothstep(1.0, 0.25, r), 1.0);
}`;

const HOST_COLOR = '#7CF7C4';

function ringTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.strokeStyle = '#fff';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(32, 32, 24, 0, Math.PI * 2);
  g.stroke();
  return new THREE.CanvasTexture(c);
}

export function createNearbyStars() {
  /** In light-years, J2000 equatorial: one rotation to the ecliptic, one scale to km. */
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  group.matrix.copy(rotation(EQUATORIAL_TO_ECLIPTIC)).multiply(new THREE.Matrix4().makeScale(LY_KM, LY_KM, LY_KM));

  const uniforms = { pixelRatio: { value: 1 }, floorBright: { value: 0 }, opacity: { value: 0 } };
  const points = new THREE.Points(new THREE.BufferGeometry(), new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  points.frustumCulled = false;
  points.renderOrder = -1;
  group.add(points);

  const figureMaterial = new THREE.LineBasicMaterial({ color: '#6F8FC8', transparent: true, opacity: 0, depthWrite: false });
  const figureLines = new THREE.LineSegments(new THREE.BufferGeometry(), figureMaterial);
  figureLines.frustumCulled = false;
  group.add(figureLines);

  const hostMaterial = new THREE.PointsMaterial({ color: HOST_COLOR, size: 11, sizeAttenuation: false, map: ringTexture(), transparent: true, opacity: 0, depthWrite: false });
  const hostPoints = new THREE.Points(new THREE.BufferGeometry(), hostMaterial);
  hostPoints.frustumCulled = false;
  hostPoints.renderOrder = 4;
  group.add(hostPoints);

  let catalog: NearbyStarCatalog | null = null;
  let hosts: ExoHost[] = [];
  let km: AbsolutePositions[] = [];
  let hostKm: AbsolutePositions | null = null;
  /** Scene positions, km, for picking and labels. */
  let world: THREE.Vector3[] = [];
  let abs: Float32Array = new Float32Array(0);
  let hostWorld: THREE.Vector3[] = [];

  function setCatalog(c: NearbyStarCatalog) {
    catalog = c;
    const n = c.stars.length + 1;
    const pos = new Float64Array(n * 3), col = new Float32Array(n * 3);
    abs = new Float32Array(n);
    c.stars.forEach((s, i) => {
      pos.set([s[0], s[1], s[2]], i * 3);
      abs[i] = absoluteMag(s[3], starLy(s));
      col.set(starColor(s[4]), i * 3);
    });
    // The Sun, last: a G2 star like the rest once the camera has left it.
    abs[n - 1] = SUN_ABS_MAG;
    col.set(starColor(0.65), (n - 1) * 3);
    const stars = new AbsolutePositions(points, pos);
    const figures = new AbsolutePositions(figureLines, c.asterisms.flatMap(([a, b]) => [...c.stars[a].slice(0, 3), ...c.stars[b].slice(0, 3)]));
    km = [stars, figures];
    points.geometry.setAttribute('position', stars.attribute);
    points.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    points.geometry.setAttribute('absMag', new THREE.BufferAttribute(abs, 1));
    figureLines.geometry.setAttribute('position', figures.attribute);
    group.updateMatrixWorld(true);
    world = c.stars.map(s => new THREE.Vector3(s[0], s[1], s[2]).applyMatrix4(group.matrix));
  }

  function setHosts(h: ExoHost[]) {
    hosts = h;
    const pos = h.flatMap(x => bodyDirection(x.dec, x.ra).map(v => v * x.ly));
    hostKm = new AbsolutePositions(hostPoints, pos);
    hostPoints.geometry.setAttribute('position', hostKm.attribute);
    hostWorld = h.map((x, i) => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(group.matrix));
  }

  /** `k` fades the stars and host rings, `figures` the constellation lines; `floor` keeps faint stars visible once the camera is out among them. */
  function update(k: number, floor: number, figures: number, hostsOn: boolean, hostsFade = 1) {
    uniforms.opacity.value = k;
    uniforms.floorBright.value = floor;
    uniforms.pixelRatio.value = Math.min(window.devicePixelRatio, 2);
    points.visible = k > 0.005 && !!catalog;
    figureMaterial.opacity = 0.35 * figures;
    figureLines.visible = figureMaterial.opacity > 0.005;
    // The rings are a guide near the Sun; from far out the hosts are a crowd, so they thin.
    hostMaterial.opacity = hostsOn ? 0.75 * k * hostsFade : 0;
    hostPoints.visible = hostMaterial.opacity > 0.005 && hosts.length > 0;
  }

  return {
    group, update, setCatalog, setHosts,
    rebase(origin: THREE.Vector3) {
      km.forEach(k => k.rebase(origin));
      hostKm?.rebase(origin);
    },
    catalog: () => catalog,
    hosts: () => hosts,
    /** Scene position of star `i`, km. */
    position: (i: number) => world[i],
    hostPosition: (i: number) => hostWorld[i],
    absMag: (i: number) => abs[i],
    count: () => world.length,
  };
}

export type NearbyStars = ReturnType<typeof createNearbyStars>;
