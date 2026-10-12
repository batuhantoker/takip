import * as THREE from 'three';
import { EQUATORIAL_TO_ECLIPTIC, mul } from '@/lib/space/frames';
import type { SkyBodyDef } from '@/lib/space/sky';
import { bodyGeometry, dotTexture, loadTexture, v3 } from './shared';

/** The Sun and the planets: a sphere each, plus a marker that keeps them visible as dots from afar. */

export const SUN_RADIUS_KM = 695_700;
// AIA and HMI frames are 1024 px at 2.4"/px; the disc's radius is ~400 px of that.
const SDO_FRAME_PER_RADIUS = 1024 / 400;

export function createSun() {
  const group = new THREE.Group();
  const core = new THREE.Mesh(bodyGeometry(SUN_RADIUS_KM * 0.995, 64), new THREE.MeshBasicMaterial({ color: 0xffe2a0 }));
  group.add(core);

  const glowTexture = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,240,200,1)');
    grad.addColorStop(0.12, 'rgba(255,214,120,0.85)');
    grad.addColorStop(0.35, 'rgba(255,160,60,0.25)');
    grad.addColorStop(1, 'rgba(255,120,30,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  })();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.scale.setScalar(SUN_RADIUS_KM * 9);
  group.add(glow);

  // The latest SDO frame, turned to face the camera: it is the disc as Earth sees it.
  const sdoMaterial = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  const sdo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sdoMaterial);
  sdo.scale.setScalar(2 * SUN_RADIUS_KM * SDO_FRAME_PER_RADIUS);
  group.add(sdo);

  let frameUrl = '';
  function setFrame(url: string | null) {
    if (!url || url === frameUrl) return;
    frameUrl = url;
    loadTexture(url, t => {
      sdoMaterial.map?.dispose();
      sdoMaterial.map = t;
      sdoMaterial.opacity = 1;
      sdoMaterial.needsUpdate = true;
    });
  }

  return { group, core, glow, sdo, setFrame };
}

export interface Planet {
  def: SkyBodyDef;
  /** Translated to the body's position each frame. */
  group: THREE.Group;
  /** Rotated to the body's orientation, where it is known; children are body-fixed. */
  spin: THREE.Group;
  mesh: THREE.Mesh;
  marker: THREE.Sprite;
}

const markerMap = dotTexture(64, 0.35);

export function createPlanet(def: SkyBodyDef, textureUrl?: string): Planet {
  const group = new THREE.Group();
  const spin = new THREE.Group();
  group.add(spin);
  const material = new THREE.MeshLambertMaterial({ color: textureUrl ? 0xffffff : def.color });
  if (textureUrl) loadTexture(textureUrl, t => { material.map = t; material.needsUpdate = true; });
  const mesh = new THREE.Mesh(bodyGeometry(def.radiusKm, def.key === 'moon' || def.key === 'mars' ? 128 : 64), material);
  spin.add(mesh);
  const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerMap, color: def.color, sizeAttenuation: false, depthWrite: false, transparent: true }));
  marker.scale.setScalar(0.012);
  marker.renderOrder = 2;
  group.add(marker);
  if (def.key === 'saturn') group.add(saturnRings());
  return { def, group, spin, mesh, marker };
}

/** Saturn's rings, in the plane of its equator (pole RA 40.59°, Dec 83.54°, J2000). */
function saturnRings(): THREE.Mesh {
  const inner = 74_500, outer = 140_220;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  const bands: [number, string][] = [[0, 'rgba(0,0,0,0)'], [0.53, 'rgba(120,110,95,0.25)'], [0.62, 'rgba(210,190,150,0.75)'], [0.8, 'rgba(225,205,165,0.9)'], [0.82, 'rgba(30,25,20,0.15)'], [0.86, 'rgba(200,180,140,0.7)'], [0.97, 'rgba(190,170,130,0.5)'], [1, 'rgba(0,0,0,0)']];
  const grad = g.createRadialGradient(256, 256, 0, 256, 256, 256);
  for (const [stop, color] of bands) grad.addColorStop(stop, color);
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  const texture = new THREE.CanvasTexture(c);
  const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 128, 1), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true, depthWrite: false }));
  // RingGeometry's planar UVs span ±outer, so the texture's edge is the outer rim.
  const dec = 83.537 * Math.PI / 180, ra = 40.589 * Math.PI / 180;
  const pole = mul(EQUATORIAL_TO_ECLIPTIC, [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)]);
  ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), v3(pole));
  return ring;
}
