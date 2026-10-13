/**
 * TAKIP — matching the Earth map's globe and the space view's Earth, so
 * zooming between them is one motion: the same size on screen, seen from the
 * same side. MapLibre's globe radius is worldSize / 2π / cos(lat) pixels
 * (maplibre-gl globe_utils), and its camera sits cameraToCenterDistance =
 * (height / 2) / tan(fov / 2) pixels from the centre point, tilted by pitch.
 */

import { add, norm, scale } from './astro';
import { bodyDirection } from './frames';
import type { Vec3 } from './horizons';

export interface GlobeView {
  lat: number;
  lng: number;
  zoom: number;
  /** Degrees. */
  pitch: number;
  bearing: number;
  /** CSS pixels. */
  height: number;
  /** MapLibre's vertical field of view, degrees. */
  fov: number;
  minZoom?: number;
}

const DEG = Math.PI / 180;
const TILE = 512;

function geometry(v: Pick<GlobeView, 'lat' | 'zoom' | 'pitch' | 'height' | 'fov'>) {
  const radius = (TILE * 2 ** v.zoom) / (2 * Math.PI) / Math.cos(v.lat * DEG);
  const toCentre = v.height / 2 / Math.tan((v.fov * DEG) / 2);
  const p = v.pitch * DEG;
  const dist = Math.hypot(toCentre * Math.cos(p) + radius, toCentre * Math.sin(p));
  return { radius, toCentre, p, dist };
}

/** The globe's radius on screen, pixels. */
export function globeRadiusPx(v: Pick<GlobeView, 'lat' | 'zoom' | 'pitch' | 'height' | 'fov'>): number {
  const g = geometry(v);
  return Math.tan(Math.asin(Math.min(1, g.radius / g.dist))) * g.toCentre;
}

/** Camera distance from the centre of a sphere of `radiusKm` that draws it `rPx` in radius. */
export function distanceForRadius(rPx: number, height: number, fovDeg: number, radiusKm: number): number {
  const f = height / 2 / Math.tan((fovDeg * DEG) / 2);
  return radiusKm / Math.sin(Math.atan(rPx / f));
}

/** Where the map's camera looks at Earth from, as an Earth-fixed unit vector from its centre. */
export function globeCameraDirection(v: GlobeView): Vec3 {
  const g = geometry(v);
  const la = v.lat * DEG, lo = v.lng * DEG, b = v.bearing * DEG;
  const n = bodyDirection(v.lat, v.lng);
  const north: Vec3 = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
  const east: Vec3 = [-Math.sin(lo), Math.cos(lo), 0];
  // Pitch swings the camera back, away from the way the screen's top faces.
  const back = scale(add(scale(north, Math.cos(b)), scale(east, Math.sin(b))), -1);
  const d = add(scale(n, g.toCentre * Math.cos(g.p) + g.radius), scale(back, g.toCentre * Math.sin(g.p)));
  return scale(d, 1 / norm(d));
}

/** Degrees between the map's centre point and the point under its camera, seen from Earth's centre. */
export function globeCentreOffsetDeg(v: Pick<GlobeView, 'lat' | 'zoom' | 'pitch' | 'height' | 'fov'>): number {
  const g = geometry(v);
  return Math.atan2(g.toCentre * Math.sin(g.p), g.toCentre * Math.cos(g.p) + g.radius) / DEG;
}

/** How far below the screen's centre the map draws the globe's centre, pixels: pitch looks past it. */
export function globeCentreDropPx(v: Pick<GlobeView, 'lat' | 'zoom' | 'pitch' | 'height' | 'fov'>): number {
  const g = geometry(v);
  return (g.toCentre * g.radius * Math.sin(g.p)) / (g.toCentre + g.radius * Math.cos(g.p));
}

/** The map zoom whose globe is `rPx` in radius on screen, everything else held. */
export function zoomForRadius(rPx: number, v: Omit<GlobeView, 'zoom' | 'lng' | 'bearing'>): number {
  let lo = -2, hi = 8;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (globeRadiusPx({ ...v, zoom: mid }) < rPx) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
