import { DEG } from './globe-geometry';

/* The map's opening camera: zoom 1.8 over [UTC-offset longitude, 20°N] (src/lib/map-create.ts), eased to
   pitch 20 once ready (world-map.tsx). If that changes, the splash globe just lands a little off the real one. */
const MAP_ZOOM = 1.8;
const MAP_LAT = 20 * DEG;
const MAP_PITCH = 20 * DEG;

/** The longitude the map opens facing: the viewer's UTC offset at 15° an hour. */
export const facingLongitude = () => Math.max(-180, Math.min(180, -new Date().getTimezoneOffset() / 4)) * DEG;

/** Where MapLibre draws its opening globe in a viewport, and the latitude the camera sees it from. */
export function mapGlobe(width: number, height: number) {
  const r = (512 * 2 ** MAP_ZOOM) / (2 * Math.PI) / Math.cos(MAP_LAT);
  // MapLibre's camera distance for its 36.87° vertical field of view.
  const f = 1.5 * height;
  const along = f * Math.cos(MAP_PITCH) + r;
  const across = f * Math.sin(MAP_PITCH);
  return {
    cx: width / 2,
    cy: height / 2 + (f * r * Math.sin(MAP_PITCH)) / (f + r * Math.cos(MAP_PITCH)),
    r: f * Math.tan(Math.asin(r / Math.hypot(along, across))),
    lat: MAP_LAT - Math.atan2(across, along),
  };
}

/** Radius of the splash globe inside its canvas box; leaves room for the orbit either side. */
export const splashGlobeRadius = (w: number, h: number) => Math.min(h * 0.4, w / 2.9);
