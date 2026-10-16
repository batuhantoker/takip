import * as THREE from 'three';
import { AU_KM, norm } from '@/lib/space/astro';
import { CROSSINGS, crossingPoint, fitHeliosphere, NOSE, shellRadiusAu, TAIL_COS, VOYAGER_DIRECTIONS, type ShellKey } from '@/lib/space/deep/heliosphere';
import type { Vec3 } from '@/lib/space/horizons';
import { dotTexture, LOGDEPTH } from '../shared';

/**
 * The termination shock and the heliopause as faint shells, brightest at
 * their outline, and the four points where the Voyagers crossed them. The
 * shells are a model fitted through those crossings (lib/space/deep/heliosphere).
 */

export const SHELL_COLOR: Record<ShellKey, string> = { 'termination-shock': '#FFB36B', heliopause: '#7FB8FF' };

const VERT = `
${LOGDEPTH.vertexPars}
attribute float alpha;
uniform float nearKm;
varying float vAlpha;
varying float vRim;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 n = normalize(normalMatrix * normal);
  vRim = 1.0 - abs(dot(n, normalize(-mv.xyz)));
  // Surface close to the camera fades, so flying through the tail never fills the screen.
  vAlpha = alpha * smoothstep(0.35, 1.2, length(mv.xyz) / nearKm);
  gl_Position = projectionMatrix * mv;
  ${LOGDEPTH.vertex}
}`;

const FRAG = `
${LOGDEPTH.fragmentPars}
uniform vec3 color;
uniform float opacity;
varying float vAlpha;
varying float vRim;
void main() {
  ${LOGDEPTH.fragment}
  gl_FragColor = vec4(color, opacity * vAlpha * (0.08 + 0.92 * pow(vRim, 3.0)));
}`;

function shellGeometry(key: ShellKey, shell: ReturnType<typeof fitHeliosphere>[ShellKey]): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 96, 64);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const alpha = new Float32Array(pos.count);
  const tailCut = TAIL_COS + 0.02;
  for (let i = 0; i < pos.count; i++) {
    const d: Vec3 = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const c = d[0] * NOSE[0] + d[1] * NOSE[1] + d[2] * NOSE[2];
    // The heliopause's tail is open: behind the cut it closes at the cut's radius, faded out.
    const r = shellRadiusAu(key, shell, key === 'heliopause' && c < tailCut ? tailDir(d, tailCut) : d);
    pos.setXYZ(i, d[0] * r, d[1] * r, d[2] * r);
    alpha[i] = key === 'heliopause' ? THREE.MathUtils.smoothstep(c, TAIL_COS, TAIL_COS + 0.45) : 1;
  }
  g.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  g.computeVertexNormals();
  return g;
}

/** `d` swung toward the nose until its cosine from it is `c`, for clamping the open tail. */
function tailDir(d: Vec3, c: number): Vec3 {
  const along = d[0] * NOSE[0] + d[1] * NOSE[1] + d[2] * NOSE[2];
  const perp: Vec3 = [d[0] - along * NOSE[0], d[1] - along * NOSE[1], d[2] - along * NOSE[2]];
  const p = norm(perp) || 1;
  const s = Math.sqrt(1 - c * c);
  return [NOSE[0] * c + (perp[0] / p) * s, NOSE[1] * c + (perp[1] / p) * s, NOSE[2] * c + (perp[2] / p) * s];
}

export function createHeliosphere() {
  /** In AU. */
  const group = new THREE.Group();
  group.scale.setScalar(AU_KM);
  const materials: Record<ShellKey, THREE.ShaderMaterial> = {} as Record<ShellKey, THREE.ShaderMaterial>;
  const meshes: Partial<Record<ShellKey, THREE.Mesh>> = {};
  for (const key of ['termination-shock', 'heliopause'] as ShellKey[]) {
    materials[key] = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { color: { value: new THREE.Color(SHELL_COLOR[key]) }, opacity: { value: 0 }, nearKm: { value: 100 * AU_KM } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
  }

  const marks = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({
    size: 6, sizeAttenuation: false, vertexColors: true, map: dotTexture(32, 0.5), transparent: true, depthWrite: false,
  }));
  marks.frustumCulled = false;
  marks.renderOrder = 3;

  let directions: Record<number, Vec3> = VOYAGER_DIRECTIONS;
  let crossings: { position: THREE.Vector3; label: string; color: string; shell: ShellKey }[] = [];

  function build() {
    const shells = fitHeliosphere(directions);
    for (const key of ['termination-shock', 'heliopause'] as ShellKey[]) {
      meshes[key]?.geometry.dispose();
      if (meshes[key]) group.remove(meshes[key]);
      const mesh = new THREE.Mesh(shellGeometry(key, shells[key]), materials[key]);
      mesh.frustumCulled = false;
      meshes[key] = mesh;
      group.add(mesh);
    }
    crossings = CROSSINGS.map(c => ({
      position: new THREE.Vector3(...crossingPoint(c, directions[c.craftId])),
      label: `${c.craft} crossed · ${c.date.slice(0, 4)}`,
      color: SHELL_COLOR[c.shell],
      shell: c.shell,
    }));
    const pos = new Float32Array(crossings.flatMap(c => [c.position.x, c.position.y, c.position.z]));
    const col = new Float32Array(crossings.flatMap(c => new THREE.Color(c.color).toArray()));
    marks.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    marks.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  build();

  /** Refits through each Voyager's current direction, once the fleet has it. */
  function setVoyagers(dirs: Record<number, Vec3>) {
    if (!dirs[-31] || !dirs[-32]) return;
    directions = dirs;
    build();
  }

  /** `k` fades the whole layer by camera distance; models hide when illustrations are off. */
  function update(k: number, illustrations: boolean) {
    const shown = illustrations ? k : 0;
    materials['termination-shock'].uniforms.opacity.value = 0.14 * shown;
    materials.heliopause.uniforms.opacity.value = 0.22 * shown;
    group.visible = shown > 0.01;
    (marks.material as THREE.PointsMaterial).opacity = k;
    marks.visible = k > 0.01;
  }

  /** Where each shell's label goes: its nose, toward the interstellar wind. */
  function noses(): { shell: ShellKey; position: THREE.Vector3 }[] {
    const shells = fitHeliosphere(directions);
    return (['termination-shock', 'heliopause'] as ShellKey[]).map(shell => ({ shell, position: new THREE.Vector3(...NOSE).multiplyScalar(shellRadiusAu(shell, shells[shell], NOSE) * AU_KM) }));
  }

  return { group, marks, update, setVoyagers, crossings: () => crossings, noses };
}
