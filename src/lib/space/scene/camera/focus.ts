import * as THREE from 'three';
import { AU_KM, LY_KM } from '@/lib/space/astro';
import { DEEP_FEATURES } from '@/lib/space/deep/features';
import type { FleetCraft, Region } from '@/lib/space/craft/fleet';
import { bodyDirection, earthOrientation, mul, transpose } from '@/lib/space/frames';
import { GALACTIC_CENTRE_KM, GALACTIC_NORTH } from '@/lib/space/deep/galaxy';
import { distanceForRadius, floorZoom, globeCameraDirection, globeCentreDropPx, globeCentreOffsetDeg, globeRadiusPx, zoomForRadius, type GlobeView, type MapPose } from '@/lib/space/globe-match';
import type { Vec3 } from '@/lib/space/horizons';
import type { SpaceSelection } from '@/lib/space/selection';
import type { SpaceFocus } from '@/lib/space/worlds';
import type { SpaceScene } from '../space-scene';
import type { Anchor } from '../types';
import { v3 } from '../shared';

/** Where the camera settles for each focus, and how the view opens from the map. */

export const FOCUS_DISTANCE_KM: Record<SpaceFocus, number> = {
  earth: 150_000,
  moon: 9_000,
  mars: 21_000,
  sun: 5_000_000,
  solar: 1.1e9,
  stars: 45 * LY_KM,
  galaxy: 115_000 * LY_KM,
  universe: 120e9 * LY_KM,
};

export function focusAnchor(f: SpaceFocus): Anchor {
  if (f === 'solar' || f === 'stars') return { kind: 'system' };
  return f === 'galaxy' || f === 'universe' ? { kind: 'galaxy' } : { kind: 'body', key: f };
}

/** The stop a free camera is nearest to, for the switcher to follow the wheel. */
export function focusForView(anchor: Anchor, sunKm: number): SpaceFocus | null {
  if (anchor.kind === 'galaxy') return sunKm > 50e6 * LY_KM ? 'universe' : 'galaxy';
  if (anchor.kind !== 'system') return anchor.kind === 'body' && (['earth', 'moon', 'mars', 'sun'] as string[]).includes(anchor.key) ? anchor.key as SpaceFocus : null;
  return sunKm < 0.05 * LY_KM ? 'solar' : sunKm < 3_000 * LY_KM ? 'stars' : 'galaxy';
}

/** The sunlit side, leaning toward Earth, so a body opens lit rather than as a black disc. */
function litSide(scene: SpaceScene, key: 'moon' | 'mars', jd: number): THREE.Vector3 | undefined {
  const body = scene.model.bodyPos(key, jd), earth = scene.model.bodyPos('earth', jd);
  if (!body || !earth) return undefined;
  const p = v3(body);
  const toSun = p.clone().negate().normalize();
  const toEarth = v3(earth).sub(p).normalize();
  return toSun.multiplyScalar(0.75).add(toEarth.multiplyScalar(0.25)).normalize();
}

export function focusDirection(scene: SpaceScene, f: SpaceFocus, jd: number): THREE.Vector3 | undefined {
  const earth = scene.model.bodyPos('earth', jd);
  if (f === 'moon' || f === 'mars') return litSide(scene, f, jd);
  // The Sun from Earth's side: the face SDO is photographing.
  if (f === 'sun') return earth ? v3(earth).normalize() : undefined;
  if (f === 'solar' || f === 'stars') return earth ? v3(earth).normalize().multiplyScalar(0.45).add(new THREE.Vector3(0, 0, 0.9)).normalize() : new THREE.Vector3(0, -0.4, 0.9).normalize();
  // Above the disc and behind the Sun, looking in toward the centre past it.
  if (f === 'galaxy' || f === 'universe') return v3(GALACTIC_NORTH).multiplyScalar(0.8).add(v3(GALACTIC_CENTRE_KM).normalize().multiplyScalar(-0.6)).normalize();
  return undefined;
}

const CRAFT_DISTANCE_KM: Record<Region, number> = {
  'earth-orbit': 60_000, cislunar: 400_000, moon: 8_000, 'sun-earth-l1': 2_600_000, 'sun-earth-l2': 2_600_000,
  mercury: 300_000, venus: 1_000_000, mars: 20_000, jupiter: 2e7, saturn: 2e7,
  interplanetary: 4e7, outer: 4e9, interstellar: 8e9,
};

/** Out beyond the craft, looking back at it with the Sun (and Earth, for L1/L2) behind. */
export function craftView(c: FleetCraft): { distance: number; direction: THREE.Vector3 } {
  const outward = v3(c.region === 'sun-earth-l1' || c.region === 'sun-earth-l2' || c.region === 'cislunar' ? c.rel : c.helio).normalize();
  return { distance: CRAFT_DISTANCE_KM[c.region], direction: outward.add(new THREE.Vector3(0, 0, 0.35)).normalize() };
}

/**
 * The camera over a map location, at roughly the height the map was showing:
 * MapLibre's globe at zoom z spans about 94,000 / 2^z km of camera distance
 * on a ~1000 px tall view.
 */
export function mapEntry(jd: number, lat: number, lng: number, zoom: number): { direction: THREE.Vector3; distance: number } {
  const dir = mul(earthOrientation(jd), bodyDirection(lat, lng));
  return { direction: v3(dir), distance: Math.max(9_000, 94_000 / 2 ** zoom + 6371) };
}

/** Past the planets: where to stand for a star, a dwarf planet or a feature. */
export function deepView(sel: SpaceSelection, positionOf: (a: Anchor) => THREE.Vector3 | undefined): { anchor: Anchor; distance: number; direction?: THREE.Vector3 } | null {
  // Out beyond a star or a body, looking back toward the Sun.
  const beyond = (anchor: Anchor, distance: number) => {
    const at = positionOf(anchor);
    return { anchor, distance, direction: at?.lengthSq() ? at.clone().normalize().add(new THREE.Vector3(0, 0, 0.3)).normalize() : undefined };
  };
  if (sel.kind === 'star') return beyond({ kind: 'star', index: sel.index }, 0.35 * LY_KM);
  if (sel.kind === 'exohost') return beyond({ kind: 'exohost', name: sel.name }, 0.35 * LY_KM);
  if (sel.kind === 'outer') return beyond({ kind: 'outer', key: sel.key }, 4e8);
  if (sel.kind !== 'feature') return null;
  const f = DEEP_FEATURES[sel.id];
  if (!f) return null;
  if (sel.id === 'milky-way') return { anchor: { kind: 'galaxy' }, distance: FOCUS_DISTANCE_KM.galaxy };
  if (sel.id === 'cmb') return { anchor: { kind: 'galaxy' }, distance: FOCUS_DISTANCE_KM.universe };
  if (sel.id.startsWith('cosmos:')) return { anchor: { kind: 'feature', id: sel.id }, distance: 60e6 * LY_KM };
  if (f.position) return { anchor: { kind: 'feature', id: sel.id }, distance: Math.max(f.radiusKm ?? LY_KM, 2_000 * LY_KM) * 5 };
  const au: Record<string, number> = {
    'termination-shock': 450, heliopause: 450, 'kuiper-belt': 160, 'gravitational-focus': 2_600,
    'light-day': 700, 'light-week': 4_500, 'light-month': 20_000, 'light-year': 250_000, 'oort-cloud': 350_000,
  };
  return { anchor: { kind: 'system' }, distance: (au[sel.id] ?? 500) * AU_KM };
}

/** How the Earth map draws its globe, for meeting it on the way out and on the way back. */
export interface MapLink { pitch: number; fov: number; height: number; minZoom: number }
/** The map's globe overview: MapLibre's default field of view, the resting tilt, the zoom floor. */
export const DEFAULT_MAP_LINK: MapLink = { pitch: 20, fov: 36.87, height: 800, minZoom: 1.5 };

const EARTH_KM = 6371;
/** The map takes back over a little inside its zoom floor, so the wheel carries straight on. */
const RETURN_ZOOM_ABOVE_FLOOR = 0.1;

/** The camera on the map globe's exact view: Earth the same size on screen, seen from the same side. */
export function globeEntry(jd: number, view: GlobeView, camera: { fov: number; height: number }): { direction: THREE.Vector3; distance: number } {
  const r = globeRadiusPx(view);
  return { direction: v3(mul(earthOrientation(jd), globeCameraDirection(view))), distance: distanceForRadius(r, camera.height, camera.fov, EARTH_KM) };
}

/** As globeEntry, plus how far down the tilted map draws the globe and which way is up on its screen. */
export function globePose(jd: number, view: GlobeView, camera: { fov: number; height: number }): { direction: THREE.Vector3; distance: number; drop: number; up: THREE.Vector3 } {
  const la = view.lat * Math.PI / 180, lo = view.lng * Math.PI / 180, b = view.bearing * Math.PI / 180;
  const north: Vec3 = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
  const east: Vec3 = [-Math.sin(lo), Math.cos(lo), 0];
  const up: Vec3 = [0, 1, 2].map(i => north[i] * Math.cos(b) + east[i] * Math.sin(b)) as Vec3;
  return { ...globeEntry(jd, view, camera), drop: globeCentreDropPx(view) * (camera.height / view.height), up: v3(mul(earthOrientation(jd), up)) };
}

/** The globe just inside the map's zoom floor, as the map draws it at the equator (and so, by the floor's design, everywhere). */
const returnGlobe = (link: MapLink) => ({ lat: 0, zoom: link.minZoom + RETURN_ZOOM_ABOVE_FLOOR, pitch: link.pitch, height: link.height, fov: link.fov });

/** Nearer than this to Earth, zooming in lands back on the map, just inside its zoom floor. */
export function mapReturnKm(link: MapLink, camera: { fov: number; height: number }): number {
  return distanceForRadius(globeRadiusPx(returnGlobe(link)), camera.height, camera.fov, EARTH_KM);
}

/** How far below centre the map draws its globe on landing, in the map's pixels. */
export function mapReturnDropPx(link: MapLink): number {
  return globeCentreDropPx(returnGlobe(link));
}

/** The map view under the camera, at the zoom that draws Earth the size it is now. */
export function mapReturn(jd: number, fromEarth: THREE.Vector3, link: MapLink, camera: { fov: number; height: number }): Required<MapPose> {
  const under = subCamera(jd, fromEarth);
  const f = camera.height / 2 / Math.tan((camera.fov * Math.PI) / 360);
  const rPx = Math.tan(Math.asin(Math.min(1, EARTH_KM / fromEarth.length()))) * f;
  // The tilted map looks north of the point under its camera; centre it there so the same side shows.
  let lat = under.lat, zoom = link.minZoom;
  for (let i = 0; i < 3; i++) {
    zoom = zoomForRadius(rPx, { lat, pitch: link.pitch, height: link.height, fov: link.fov });
    lat = Math.min(85, under.lat + globeCentreOffsetDeg({ lat, zoom, pitch: link.pitch, height: link.height, fov: link.fov }));
  }
  // Space keeps north up near Earth, so the map comes back unrotated.
  return { lat, lng: under.lng, zoom: Math.max(floorZoom(link.minZoom, lat) + 0.02, zoom), pitch: link.pitch, bearing: 0 };
}

/** Latitude and longitude straight below the camera. */
export function subCamera(jd: number, fromEarth: THREE.Vector3): { lat: number; lng: number } {
  const len = fromEarth.length();
  const d = mul(transpose(earthOrientation(jd)), [fromEarth.x / len, fromEarth.y / len, fromEarth.z / len] as Vec3);
  return { lat: Math.asin(d[2]) * 180 / Math.PI, lng: Math.atan2(d[1], d[0]) * 180 / Math.PI };
}
