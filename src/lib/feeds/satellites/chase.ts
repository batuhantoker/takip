/*
 * Riding a satellite on the globe. MapLibre's globe camera ignores centre elevation: it always orbits
 * a point on the ground. So to hold a satellite drawn high above the Earth at the middle of the view,
 * the camera looks at the ground point its line of sight to the satellite reaches, a little ahead of
 * the satellite along the view's bearing.
 */

/** MapLibre's globe radius in metres (GLOBE_RADIUS in its globe shaders). */
const GLOBE_RADIUS_M = 6371008.8;
const RAD = Math.PI / 180;

export type ChaseView = { zoom: number; pitch: number; bearing: number; fovDeg: number; heightPx: number };

/** The point `angle` radians along a great circle from (lng, lat) on `bearing` (degrees). */
function along(lng: number, lat: number, bearing: number, angle: number): [number, number] {
  const φ = lat * RAD, λ = lng * RAD, θ = bearing * RAD;
  const φ2 = Math.asin(Math.sin(φ) * Math.cos(angle) + Math.cos(φ) * Math.sin(angle) * Math.cos(θ));
  const λ2 = λ + Math.atan2(Math.sin(θ) * Math.sin(angle) * Math.cos(φ), Math.cos(angle) - Math.sin(φ) * Math.sin(φ2));
  return [((((λ2 / RAD) + 540) % 360) - 180), φ2 / RAD];
}

/**
 * The ground centre that puts a point `elevM` above (lng, lat) at the middle of a globe view. Mirrors
 * MapLibre's globe camera (vertical_perspective_transform.ts): globe radius worldSize / 2π / cos(centre
 * latitude) pixels, the camera 0.5 / tan(fov / 2) × height pixels from the centre, tilted back by the pitch.
 */
export function chaseCentre(lng: number, lat: number, elevM: number, view: ChaseView): [number, number] {
  const p = view.pitch * RAD;
  const h = elevM / GLOBE_RADIUS_M;
  const toCentrePx = (0.5 / Math.tan((view.fovDeg * RAD) / 2)) * view.heightPx;
  let centre: [number, number] = [lng, lat];
  // The globe's pixel radius depends on the centre's latitude, which depends on the answer: twice is plenty.
  for (let i = 0; i < 2; i++) {
    const radiusPx = (512 * 2 ** view.zoom) / (2 * Math.PI) / Math.cos(centre[1] * RAD);
    const d = toCentrePx / radiusPx;
    // In the centre's frame (unit sphere, up through the centre) the camera sits d back along the view,
    // tilted by the pitch; the satellite is where that line of sight is 1 + h from the globe's middle.
    const u = (-Math.cos(p) + Math.sqrt(Math.cos(p) ** 2 + (1 + h) ** 2 - 1)) / d;
    const angle = Math.atan2(d * Math.sin(p) * u, 1 + d * Math.cos(p) * u);
    centre = along(lng, lat, view.bearing, angle);
  }
  return centre;
}
