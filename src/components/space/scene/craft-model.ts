import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * A spacecraft's 3D model in the scene, for the one craft in focus (replayed,
 * selected or followed). At true size a probe is metres across and invisible
 * from any useful distance, so the model never shrinks below a readable size
 * on screen; close enough, it is drawn at its real size. Deep-space probes keep
 * their high-gain dish on Earth, so where the dish's axis is known the model is
 * turned to point it there.
 */

export interface ModelSpec {
  url: string;
  /** Real longest dimension, metres. */
  sizeM: number;
  /** Longest dimension in the model's own units. */
  modelSize: number;
  hga?: [number, number, number];
  up?: [number, number, number];
}

/** The smallest the model is drawn, as a fraction of the view's height. */
const MIN_SCREEN = 0.07;

// NASA's files are mostly Draco-compressed; the decoder is three's own, copied to /vendor/draco.
const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('/vendor/draco/'));
/** Light on the side away from the Sun: real, but a black silhouette tells the operator nothing. */
const FILL = 0.14;

function fill(object: THREE.Object3D) {
  object.traverse(o => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!m || !('emissive' in m) || m.userData.filled) return;
    m.userData.filled = true;
    if (!m.emissiveMap && m.map) m.emissiveMap = m.map;
    m.emissive.setScalar(FILL);
    m.needsUpdate = true;
  });
}
const cache = new Map<string, Promise<THREE.Object3D>>();

function load(url: string): Promise<THREE.Object3D> {
  let p = cache.get(url);
  if (!p) {
    p = loader.loadAsync(url).then(g => g.scene);
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

export function createCraftModel() {
  const holder = new THREE.Group();
  holder.visible = false;
  let current: { key: string; spec: ModelSpec; object: THREE.Object3D | null } | null = null;
  const toEarth = new THREE.Vector3();
  const axis = new THREE.Vector3();

  /** Shows `spec` for craft `key`, loading it once; null hides the model. */
  function show(key: string | null, spec: ModelSpec | null) {
    if (!key || !spec) {
      holder.visible = false;
      current = null;
      return;
    }
    if (current?.key === key) return;
    current = { key, spec, object: null };
    holder.clear();
    load(spec.url).then(scene => {
      if (current?.key !== key) return;
      const object = scene.clone(true);
      fill(object);
      // A model's own frame may have another up axis; bring it to +Y first, then the dish is turned from there.
      if (spec.up) object.quaternion.setFromUnitVectors(new THREE.Vector3(...spec.up).normalize(), new THREE.Vector3(0, 1, 0));
      current.object = object;
      holder.add(object);
    }).catch(e => console.warn('[TAKIP] craft model', spec.url, e instanceof Error ? e.message : e));
  }

  /** Places the model on the craft, sized for the camera, its dish on Earth. */
  function update(position: THREE.Vector3 | null, earth: THREE.Vector3 | null, camera: THREE.PerspectiveCamera, viewHeight: number) {
    const c = current;
    holder.visible = !!c?.object && !!position;
    if (!c || !c.object || !position) return;
    holder.position.copy(position);
    const distance = camera.position.distanceTo(position);
    const pxPerRad = viewHeight / 2 / Math.tan((camera.fov * Math.PI) / 360);
    const minKm = (distance * MIN_SCREEN * viewHeight) / pxPerRad;
    const sizeKm = Math.max(c.spec.sizeM / 1000, minKm);
    holder.scale.setScalar(sizeKm / c.spec.modelSize);
    if (c.spec.hga && earth) {
      toEarth.copy(earth).sub(position).normalize();
      axis.set(...c.spec.hga).normalize();
      if (c.spec.up) axis.applyQuaternion(c.object.quaternion);
      holder.quaternion.setFromUnitVectors(axis, toEarth);
    } else holder.quaternion.identity();
  }

  return { holder, show, update, showing: () => current?.key ?? null, ready: () => !!current?.object };
}
