/** A point on or above the globe, in degrees and Earth radii from the centre (1 = surface). */
export interface GlobePoint { lng: number; lat: number; radius: number }

const toVec = ({ lng, lat, radius }: GlobePoint): [number, number, number] => {
  const la = lat * Math.PI / 180, lo = lng * Math.PI / 180;
  return [radius * Math.cos(la) * Math.cos(lo), radius * Math.cos(la) * Math.sin(lo), radius * Math.sin(la)];
};

/** Whether the straight line from the camera to the point clears the Earth, i.e. the point is not behind the globe. */
export function inFrontOfGlobe(point: GlobePoint, camera: GlobePoint): boolean {
  const c = toVec(camera);
  const s = toVec(point);
  const d = [s[0] - c[0], s[1] - c[1], s[2] - c[2]];
  const a = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  if (a === 0) return true;
  const b = 2 * (c[0] * d[0] + c[1] * d[1] + c[2] * d[2]);
  const k = c[0] * c[0] + c[1] * c[1] + c[2] * c[2] - 1;
  const disc = b * b - 4 * a * k;
  if (disc < 0) return true;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return !(t > 0 && t < 1);
}

/**
 * Where MapLibre's globe camera sits, from the public view state. Mirrors its
 * own maths: globe radius worldSize / 2π / cos(centre latitude) pixels, camera
 * 0.5 / tan(fov / 2) × height pixels from the centre, tilted back by the pitch.
 */
export function globeCamera(view: { lng: number; lat: number; zoom: number; pitch: number; bearing: number; fovDeg: number; heightPx: number }): GlobePoint {
  const rad = Math.PI / 180;
  const radiusPx = (512 * 2 ** view.zoom) / (2 * Math.PI) / Math.cos(view.lat * rad);
  const dist = (0.5 / Math.tan((view.fovDeg * rad) / 2)) * view.heightPx / radiusPx;
  const la = view.lat * rad, lo = view.lng * rad, p = view.pitch * rad, b = view.bearing * rad;
  const up = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  const east = [-Math.sin(lo), Math.cos(lo), 0];
  const north = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
  const fwd = north.map((n, i) => Math.cos(b) * n + Math.sin(b) * east[i]);
  const c = up.map((u, i) => u + dist * (Math.cos(p) * u - Math.sin(p) * fwd[i]));
  const r = Math.hypot(c[0], c[1], c[2]);
  return { lng: Math.atan2(c[1], c[0]) / rad, lat: Math.asin(c[2] / r) / rad, radius: r };
}
