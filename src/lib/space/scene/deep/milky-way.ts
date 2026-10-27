import * as THREE from 'three';
import { LY_KM } from '@/lib/space/astro';
import { EQUATORIAL_TO_ECLIPTIC, GALACTIC_TO_ECLIPTIC, mul } from '@/lib/space/frames';
import { GALACTIC_CENTRE_LY } from '@/lib/space/deep/galaxy';
import { LOGDEPTH, loadTexture, rotation } from '../shared';

/**
 * The Milky Way two ways. From inside: NASA SVS's starless Milky Way on a
 * sphere that travels with the camera, under the real 3D stars. From outside:
 * R. Hurt's face-on artwork laid in the galactic plane, placed so its Sun and
 * centre land on the real ones; it is an illustration and labelled as one.
 */

/** NASA SVS Deep Star Maps 2020, `milkyway_2020_4k` (tools/build-milky-way-sky.mjs): equirectangular RA/Dec. */
const SKY_URL = '/data/sky/milky-way-sky.jpg';
/** RA 0h at the centre, increasing to the left as seen from inside: u = 0.5 − RA / 360, v = (90 − Dec) / 180, v down. */
const SKY_U0 = 0.5, SKY_U_PER_DEG = -1 / 360;

/** NASA/JPL-Caltech/R. Hurt (SSC/Caltech), ssc2008-10a1 / PIA10748, seen from the north galactic pole. */
const DISC_URL = '/data/sky/milky-way-face-on.jpg';
/**
 * Image positions (u right, v down) of the galactic centre and the Sun, measured
 * on the annotated ssc2008-10b1, and the image direction of l = 90° from the Sun.
 * The artwork puts the Sun ~26,100 ly out; it is stretched 2% to the measured distance.
 */
const DISC = { centre: [0.5, 0.4996], sun: [0.5002, 0.6916], l90: [-1, 0] } as const;

const SKY_RADIUS_KM = 1e12;

const SKY_VERT = `
${LOGDEPTH.vertexPars}
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  ${LOGDEPTH.vertex}
}`;

const SKY_FRAG = `
${LOGDEPTH.fragmentPars}
uniform sampler2D map;
uniform float opacity;
uniform float u0;
uniform float uPerDeg;
varying vec3 vDir;
void main() {
  ${LOGDEPTH.fragment}
  vec3 d = normalize(vDir);
  float ra = degrees(atan(d.y, d.x));
  float dec = degrees(asin(clamp(d.z, -1.0, 1.0)));
  vec2 uv = vec2(fract(u0 + uPerDeg * ra), 0.5 + dec / 180.0);
  gl_FragColor = vec4(texture2D(map, uv).rgb * opacity, 1.0);
  #include <colorspace_fragment>
}`;

/** Galactic-frame position, light-years from the Sun, of image point (u, v). */
function discPoint(u: number, v: number): THREE.Vector3 {
  const [cu, cv] = DISC.centre, [su, sv] = DISC.sun;
  const s = new THREE.Vector2(su - cu, sv - cv);
  const ly = GALACTIC_CENTRE_LY / s.length();
  const toSun = s.clone().normalize();
  const l90 = new THREE.Vector2(...DISC.l90).normalize();
  const w = new THREE.Vector2(u - cu, v - cv);
  // Toward the Sun is −x (the centre is at +x from the Sun); l = 90° is +y.
  return new THREE.Vector3(GALACTIC_CENTRE_LY - w.dot(toSun) * ly, w.dot(l90) * ly, 0);
}

function discGeometry(): THREE.BufferGeometry {
  const corners: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const pos = new Float32Array(corners.flatMap(([u, v]) => discPoint(u, v).toArray()));
  const uv = new Float32Array(corners.flatMap(([u, v]) => [u, 1 - v]));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex([0, 2, 1, 0, 3, 2]);
  return g;
}

function coreGlow(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,236,200,0.9)');
  grad.addColorStop(0.25, 'rgba(255,200,140,0.35)');
  grad.addColorStop(1, 'rgba(255,170,100,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function createMilkyWay() {
  const skyUniforms = { map: { value: null as THREE.Texture | null }, opacity: { value: 0 }, u0: { value: SKY_U0 }, uPerDeg: { value: SKY_U_PER_DEG } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS_KM, 64, 32), new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: skyUniforms, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  sky.matrixAutoUpdate = false;
  sky.frustumCulled = false;
  sky.renderOrder = -2;
  const skyRotation = rotation(EQUATORIAL_TO_ECLIPTIC);

  /** In light-years, galactic frame. */
  const galaxy = new THREE.Group();
  galaxy.matrixAutoUpdate = false;
  galaxy.matrix.copy(rotation(GALACTIC_TO_ECLIPTIC)).multiply(new THREE.Matrix4().makeScale(LY_KM, LY_KM, LY_KM));
  const discMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const disc = new THREE.Mesh(discGeometry(), discMaterial);
  disc.frustumCulled = false;
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: coreGlow(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  core.position.set(GALACTIC_CENTRE_LY, 0, 0);
  core.scale.setScalar(9_000);
  galaxy.add(disc, core);

  let skyLoading = false, discLoading = false;

  /** `skyK` and `discK` are the two layers' fades; the disc and glow are models and obey the illustrations toggle. */
  const north = new THREE.Vector3(...mul(GALACTIC_TO_ECLIPTIC, [0, 0, 1]));
  const centre = new THREE.Vector3(...mul(GALACTIC_TO_ECLIPTIC, [GALACTIC_CENTRE_LY * LY_KM, 0, 0]));

  function update(camera: THREE.Camera, skyK: number, discK: number, illustrations: boolean) {
    if (skyK > 0 && !skyLoading) {
      skyLoading = true;
      loadTexture(SKY_URL, t => { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; skyUniforms.map.value = t; });
    }
    if (discK > 0 && !discLoading) {
      discLoading = true;
      loadTexture(DISC_URL, t => { discMaterial.map = t; discMaterial.needsUpdate = true; });
    }
    sky.matrix.copy(skyRotation).setPosition(camera.position);
    skyUniforms.opacity.value = 0.6 * skyK;
    sky.visible = skyK > 0.005 && !!skyUniforms.map.value;
    // A flat sheet seen from near its plane is only a wedge across the view; it shows once the camera is well above it.
    const height = Math.abs(camera.position.clone().sub(centre).dot(north)) / LY_KM;
    const d = illustrations ? discK * THREE.MathUtils.smoothstep(height, 2_500, 25_000) : 0;
    discMaterial.opacity = 0.7 * d;
    disc.visible = d > 0.005 && !!discMaterial.map;
    (core.material as THREE.SpriteMaterial).opacity = 0.55 * d;
    galaxy.visible = d > 0.005;
  }

  return { sky, galaxy, update };
}
