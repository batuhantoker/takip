import * as THREE from 'three';
import { t } from '@/lib/core/i18n/active';
import { AU_KM, LY_KM } from '@/lib/space/astro';
import { BASINS, NEARBY_VOIDS } from '@/lib/space/deep/basins.generated';
import { NEARBY_VOID_NAMES } from '@/lib/space/deep/cosmic-web';
import { DEEP_SKY_PLACED } from '@/lib/space/deep/deep-sky';
import { DEEP_FEATURES, NEARBY_GALAXIES } from '@/lib/space/deep/features';
import { apparentMag } from '@/lib/space/deep/nearby-stars';
import type { SpaceSelection } from '@/lib/space/selection';
import { basinColor, SUPERCLUSTER_COLOR, VOID_COLOR } from '../deep/cosmic-web';
import { KIND_COLOR } from '../deep/deep-sky';
import { SHELL_COLOR } from '../deep/heliosphere';
import { inFront } from './labels';
import type { Target } from './targets';
import type { SpaceScene } from '../space-scene';

/** Labels and click targets past the planets: what each tier names, while it is in view. */

const FEATURE_COLOR = '#A9B8D6';
const STAR_COLOR = '#E8E2CF';
const HOST_COLOR = '#7CF7C4';
const VISITOR_PRIORITY = 46, DWARF_PRIORITY = 32;
/** Exoplanet hosts get labels within this distance of the camera, the nearest few at most. */
const HOST_LABEL_LY = 30;
const HOST_LABELS = 14;
/** Named stars fainter than this, as seen from the camera, go unlabelled: far out they would pile onto the Sun's crowd. */
const STAR_LABEL_MAG = 4.5;
/** Near the Sun only the best-known pictured objects are named; out in the galaxy, most of them. */
const SKY_RANK_NEAR = 85, SKY_RANK_FAR = 50, SKY_NEAR_LY = 1_000;
/** A picture this many pixels across is named whatever its rank; a black hole's only within this many picture-widths. */
const SKY_SEEN_PX = 28, SHADOW_CLOSE = 10_000;
/** The voids named on screen: the biggest-looking few, once wider than this many pixels. */
const VOID_LABELS = 5, VOID_MIN_PX = 60;
const SCL_LABELS = 3, SCL_MIN_PX = 50;
/** Laniakea is always named; the basins around it once they span this many pixels. */
const BASIN_MIN_PX = 40;
const KUIPER_LABEL = new THREE.Vector3(-0.42, -0.91, 0).normalize().multiplyScalar(44 * AU_KM);

export function deepTargets(scene: SpaceScene, jd: number, out: Target[]) {
  const f = scene.fades;
  const cam = scene.camera.position;
  const illus = scene.layers.illustrations;

  if (f.outer > 0.3) {
    for (const b of scene.outer.bodies()) {
      const p = scene.outer.positionOf(b, jd);
      if (p) out.push({ sel: { kind: 'outer', key: b.key }, position: new THREE.Vector3(...p), radiusPx: 8, text: b.name, color: b.color, priority: b.kind === 'visitor' ? VISITOR_PRIORITY : DWARF_PRIORITY });
    }
  }
  if (f.belt > 0.4 && scene.outer.distantCount()) out.push(feature('kuiper-belt', KUIPER_LABEL, t('Kuiper belt'), '#9FC4E8', 24));

  if (f.heliosphere > 0.3) {
    if (illus) for (const n of scene.heliosphere.noses()) out.push(feature(n.shell, n.position, t('{name} · model', { name: t(DEEP_FEATURES[n.shell].name) }), SHELL_COLOR[n.shell], 30));
    scene.heliosphere.crossings().forEach(c => out.push(feature(c.shell, c.position, c.label, c.color, 26)));
  }
  for (const l of scene.oort.labels(scene.sunKm, f.oort)) {
    if (l.alpha > 0.35 && (l.id !== 'oort-cloud' || illus)) out.push(feature(l.id, l.position, l.text, FEATURE_COLOR, l.id === 'oort-cloud' ? 28 : 20));
  }

  if (f.stars > 0.25) starTargets(scene, cam, out);
  if (f.disc > 0.3) out.push(feature('sgr-a', new THREE.Vector3(...DEEP_FEATURES['sgr-a'].position!), 'Sgr A*', '#FFC98A', 60));
  if (f.localGalaxies > 0.3) for (const l of scene.cosmos.labels()) {
    // Once the catalogued void is drawn, it carries Boötes' name itself; the Local Void's label is the feature's.
    if (l.id === 'cosmos:Boötes Void' && scene.web.bootes() >= 0 && f.web > 0.3) continue;
    if (l.id === 'cosmos:Local Void' && f.web > 0.3) continue;
    if (l.id !== 'cmb' || f.cmb > 0.3) out.push(feature(l.id, l.position, l.name, l.id === 'cmb' ? '#FF9F6B' : '#E6D9FF', l.id === 'cmb' ? 50 : 38));
  }
  if (f.localGroup > 0.3) {
    for (const g of NEARBY_GALAXIES) out.push(feature(g.id, new THREE.Vector3(...DEEP_FEATURES[g.id].position!), t(g.name), '#C9CFFF', g.diameterLy > 30_000 ? 55 : 34));
  }
  if (scene.layers.deepSky) deepSkyTargets(scene, cam, out);
  if (f.localGalaxies > 0.3 && illus) out.push(feature('zone-of-avoidance', new THREE.Vector3(...DEEP_FEATURES['zone-of-avoidance'].position!), t('Zone of Avoidance · illustration'), '#A9B8D6', 30));
  if (f.web > 0.3 || f.farVoids > 0.3) voidTargets(scene, cam, out);
  if (f.web > 0.3) superclusterTargets(scene, cam, out);
  if (f.web > 0.3) {
    if (scene.web.basinsLoaded() && scene.web.basinReveal() > 0.3) basinTargets(scene, cam, out);
    out.push(feature('local-void', new THREE.Vector3(...DEEP_FEATURES['local-void'].position!), t('Local Void'), VOID_COLOR.local, 36));
  }
}

function basinTargets(scene: SpaceScene, cam: THREE.Vector3, out: Target[]) {
  const pxPerRad = scene.renderer.domElement.clientHeight / 2 / Math.tan((scene.camera.fov * Math.PI) / 360);
  const forward = scene.camera.getWorldDirection(new THREE.Vector3());
  for (const b of BASINS) {
    const f = DEEP_FEATURES[b.id];
    const at = new THREE.Vector3(...f.position!);
    if (!inFront(scene.camera, at, forward)) continue;
    const px = (f.radiusKm! / at.distanceTo(cam)) * pxPerRad;
    const lan = b.id === 'laniakea';
    if (!lan && px < BASIN_MIN_PX) continue;
    out.push({ sel: { kind: 'feature', id: b.id }, position: at, radiusPx: Math.min(px * 0.4, 200), text: t(f.name), color: basinColor(b), priority: lan ? 42 : 22 + Math.min(10, px / 40) });
  }
}

/** The named structure (cosmos.json) a supercluster holds, if one lies within it: the Sloan Great Wall's richest part, say. */
export function superclusterName(scene: SpaceScene, i: number): string | null {
  const c = scene.web.superclusterCentre(i), r = scene.web.superclusterRadiusKm(i);
  const hit = scene.cosmos.labels().find(l => l.id.startsWith('cosmos:') && !/void/i.test(l.id) && l.position.distanceTo(c) < r * 1.2);
  return hit ? hit.name : null;
}

function superclusterTargets(scene: SpaceScene, cam: THREE.Vector3, out: Target[]) {
  const pxPerRad = scene.renderer.domElement.clientHeight / 2 / Math.tan((scene.camera.fov * Math.PI) / 360);
  const forward = scene.camera.getWorldDirection(new THREE.Vector3());
  const seen: { i: number; px: number }[] = [];
  scene.web.superclusters().forEach((_, i) => {
    const c = scene.web.superclusterCentre(i), r = scene.web.superclusterRadiusKm(i);
    const d = c.distanceTo(cam);
    if (d < r || !inFront(scene.camera, c, forward)) return;
    const px = (r / d) * pxPerRad;
    if (px > SCL_MIN_PX) seen.push({ i, px });
  });
  for (const { i, px } of seen.sort((a, b) => b.px - a.px).slice(0, SCL_LABELS)) {
    const n = Math.round((2 * scene.web.superclusterRadiusKm(i)) / (1e6 * LY_KM));
    const name = superclusterName(scene, i);
    out.push({ sel: { kind: 'feature', id: `scl:${i}` }, position: scene.web.superclusterCentre(i), radiusPx: Math.min(px * 0.4, 200), text: name ?? t('Supercluster, {n} million ly across', { n }), color: SUPERCLUSTER_COLOR, priority: 19 + Math.min(10, px / 40) });
  }
}

function voidTargets(scene: SpaceScene, cam: THREE.Vector3, out: Target[]) {
  const pxPerRad = scene.renderer.domElement.clientHeight / 2 / Math.tan((scene.camera.fov * Math.PI) / 360);
  const forward = scene.camera.getWorldDirection(new THREE.Vector3());
  const seen: { i: number; px: number }[] = [];
  const f = scene.fades;
  scene.web.voids().forEach((v, i) => {
    if ((v.catalogue === 'quaia' ? f.farVoids : f.web) < 0.3) return;
    const c = scene.web.voidCentre(i);
    const d = c.distanceTo(cam), r = scene.web.voidRadiusKm(i);
    // From inside, or behind the camera, there is no outline to name.
    if (d < r || !inFront(scene.camera, c, forward)) return;
    const px = (r / d) * pxPerRad;
    if (px > VOID_MIN_PX) seen.push({ i, px });
  });
  const mly = (km: number) => Math.round((2 * km) / (1e6 * LY_KM));
  for (const { i, px } of seen.sort((a, b) => b.px - a.px).slice(0, VOID_LABELS)) {
    const v = scene.web.voids()[i];
    const text = i === scene.web.bootes() ? t('Boötes Void')
      : v.nearby !== undefined ? t(NEARBY_VOID_NAMES[NEARBY_VOIDS[v.nearby].name])
      : v.catalogue === 'quaia' ? t('Supervoid, {n} million ly across', { n: mly(scene.web.voidRadiusKm(i)) })
      : t('Void, {n} million ly across', { n: mly(scene.web.voidRadiusKm(i)) });
    out.push({ sel: { kind: 'feature', id: `void:${i}` }, position: scene.web.voidCentre(i), radiusPx: Math.min(px, 400), text, color: VOID_COLOR[v.catalogue], priority: 20 + Math.min(12, px / 40) });
  }
}

function deepSkyTargets(scene: SpaceScene, cam: THREE.Vector3, out: Target[]) {
  const f = scene.fades;
  const floor = scene.sunKm < SKY_NEAR_LY * LY_KM ? SKY_RANK_NEAR : SKY_RANK_FAR;
  DEEP_SKY_PLACED.forEach(({ object: o }, i) => {
    // A Local Group galaxy's picture joins its own label.
    if (o.feature) return;
    const position = scene.deepSky.centre(i);
    const d = position.distanceTo(cam), size = scene.deepSky.sizeKm(i);
    const k = o.realm === 'milky-way' ? f.deepSkyNear : f.deepSkyFar;
    const seen = f.deepSky > 0.3 && scene.deepSky.sizePx(i) > SKY_SEEN_PX;
    const named = o.kind === 'black-hole' ? d < size * SHADOW_CLOSE : seen || (k > 0.3 && o.rank >= floor);
    // Filling the view, a picture needs no name tag: its card has it, and the tag would sit at the screen's edge.
    if (!named || scene.deepSky.sizePx(i) > scene.renderer.domElement.clientHeight * 0.6) return;
    out.push({ sel: { kind: 'feature', id: o.id }, position, radiusPx: Math.max(7, scene.deepSky.sizePx(i) / 2), text: t(o.name), color: KIND_COLOR[o.kind], priority: 30 + o.rank / 4 });
  });
}

function feature(id: string, position: THREE.Vector3, text: string, color: string, priority: number): Target {
  return { sel: { kind: 'feature', id }, position, radiusPx: 7, text, color, priority };
}

function starTargets(scene: SpaceScene, cam: THREE.Vector3, out: Target[]) {
  const stars = scene.nearby;
  const c = stars.catalog();
  if (!c) return;
  const named = new Set<number>();
  for (const [key, name] of Object.entries(c.names)) {
    const i = Number(key);
    const p = stars.position(i);
    if (!p) continue;
    named.add(i);
    const m = apparentMag(stars.absMag(i), p.distanceTo(cam) / LY_KM);
    if (m > STAR_LABEL_MAG && scene.selection?.kind !== 'star') continue;
    out.push({ sel: { kind: 'star', index: i }, position: p, radiusPx: 7, text: name, color: STAR_COLOR, priority: 36 - m });
  }
  if (!scene.layers.exoplanets) return;
  const near: { i: number; ly: number }[] = [];
  stars.hosts().forEach((_, i) => {
    const ly = stars.hostPosition(i).distanceTo(cam) / LY_KM;
    if (ly < HOST_LABEL_LY) near.push({ i, ly });
  });
  for (const { i, ly } of near.sort((a, b) => a.ly - b.ly).slice(0, HOST_LABELS)) {
    const h = stars.hosts()[i];
    out.push({ sel: { kind: 'exohost', name: h.name }, position: stars.hostPosition(i), radiusPx: 8, text: `${h.name} · ${h.planets.length}`, color: HOST_COLOR, priority: 26 + Math.min(4, h.planets.length) - ly / 10 });
  }
}

/** The brightest-looking star within a few pixels of a click, for stars without a label. */
export function pickStar(scene: SpaceScene, x: number, y: number, w: number, h: number): SpaceSelection | null {
  if (scene.fades.stars < 0.25) return null;
  const v = new THREE.Vector3();
  const cam = scene.camera.position;
  const forward = scene.camera.getWorldDirection(new THREE.Vector3());
  let best: { i: number; score: number } | null = null;
  for (let i = 0; i < scene.nearby.count(); i++) {
    const p = scene.nearby.position(i);
    if (!inFront(scene.camera, p, forward)) continue;
    v.copy(p).project(scene.camera);
    if (v.z > 1 || v.z < -1) continue;
    const d = Math.hypot((v.x + 1) / 2 * w - x, (1 - v.y) / 2 * h - y);
    if (d > 7) continue;
    const m = apparentMag(scene.nearby.absMag(i), p.distanceTo(cam) / LY_KM);
    const score = d + m;
    if (!best || score < best.score) best = { i, score };
  }
  return best ? { kind: 'star', index: best.i } : null;
}
