import * as THREE from 'three';
import { t } from '@/lib/core/i18n/active';
import { AU_KM, LY_KM } from '@/lib/space/astro';
import { DEEP_FEATURES, NEARBY_GALAXIES } from '@/lib/space/deep/features';
import { apparentMag } from '@/lib/space/deep/nearby-stars';
import type { SpaceSelection } from '@/lib/space/selection';
import { SHELL_COLOR } from '../deep/heliosphere';
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
    if (l.id !== 'cmb' || f.cmb > 0.3) out.push(feature(l.id, l.position, l.name, l.id === 'cmb' ? '#FF9F6B' : '#E6D9FF', l.id === 'cmb' ? 50 : 38));
  }
  if (f.localGroup > 0.3) {
    for (const g of NEARBY_GALAXIES) out.push(feature(g.id, new THREE.Vector3(...DEEP_FEATURES[g.id].position!), t(g.name), '#C9CFFF', g.diameterLy > 30_000 ? 55 : 34));
  }
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
  let best: { i: number; score: number } | null = null;
  for (let i = 0; i < scene.nearby.count(); i++) {
    const p = scene.nearby.position(i);
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
