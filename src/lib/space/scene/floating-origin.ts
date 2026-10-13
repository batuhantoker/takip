import * as THREE from 'three';

/**
 * Camera-relative vertices. three.js multiplies model and view matrices in
 * float64, so anything placed by its Object3D position (planets, moons, the
 * craft model, body-fixed marks) is already exact. Vertex buffers that hold
 * scene coordinates themselves (dots, trails, orbit lines, a replay's path)
 * are not: float32 steps 16 km at Earth's distance and 2,000 km at Voyager's,
 * which up close reads as dancing. Those buffers keep their float64 positions
 * here and are drawn relative to an origin kept near the camera.
 */

/** The origin moves once the camera is this many view distances from it: error stays under ~0.01 px. */
const SHIFT_RATIO = 100;

export function createOrigin() {
  const at = new THREE.Vector3();
  let placed = false;
  return {
    at,
    /** Moves the origin to the camera when the camera has strayed far from it for how close it is looking. */
    update(camera: THREE.Vector3, viewKm: number): THREE.Vector3 {
      if (!placed || camera.distanceTo(at) > SHIFT_RATIO * Math.max(viewKm, 1)) {
        at.copy(camera);
        placed = true;
      }
      return at;
    },
  };
}

const inverse = new THREE.Matrix4();

/**
 * Float64 positions drawn through a float32 attribute relative to an origin,
 * with `holder` standing at that origin. The holder must have no rotation or
 * scale of its own; its parent may (the origin is taken into the parent's frame).
 */
export class AbsolutePositions {
  readonly attribute: THREE.BufferAttribute;
  readonly km: Float64Array;
  private readonly o = new THREE.Vector3();
  private placed = false;

  constructor(readonly holder: THREE.Object3D, source: ArrayLike<number> | number) {
    this.km = typeof source === 'number' ? new Float64Array(source * 3) : Float64Array.from(source);
    this.attribute = new THREE.BufferAttribute(new Float32Array(this.km.length), 3);
    this.attribute.setUsage(THREE.DynamicDrawUsage);
    this.write();
  }

  get count() { return this.km.length / 3; }

  setXYZ(i: number, x: number, y: number, z: number) {
    const k = i * 3;
    this.km[k] = x; this.km[k + 1] = y; this.km[k + 2] = z;
    this.attribute.setXYZ(i, x - this.o.x, y - this.o.y, z - this.o.z);
    this.attribute.needsUpdate = true;
  }

  /** Re-expresses every vertex about `origin` (scene frame) if it has moved. */
  rebase(origin: THREE.Vector3) {
    const local = localOrigin(this.holder, origin);
    if (this.placed && local.equals(this.o)) return;
    this.o.copy(local);
    this.placed = true;
    this.holder.position.copy(local);
    this.write();
  }

  private write() {
    const a = this.attribute.array as Float32Array, km = this.km, { x, y, z } = this.o;
    for (let k = 0; k < km.length; k += 3) {
      a[k] = km[k] - x; a[k + 1] = km[k + 1] - y; a[k + 2] = km[k + 2] - z;
    }
    this.attribute.needsUpdate = true;
  }
}

const scratch = new THREE.Vector3();

function localOrigin(holder: THREE.Object3D, origin: THREE.Vector3): THREE.Vector3 {
  scratch.copy(origin);
  const parent = holder.parent;
  if (!parent) return scratch;
  parent.updateWorldMatrix(true, false);
  return scratch.applyMatrix4(inverse.copy(parent.matrixWorld).invert());
}
