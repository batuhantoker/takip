import * as THREE from 'three';
import { AU_KM, LY_KM } from '@/lib/space/astro';
import { DEEP_FEATURES } from '@/lib/space/deep-features';
import { GALACTIC_CENTRE_KM } from '@/lib/space/galaxy';
import { SKY_BODIES } from '@/lib/space/sky';
import { SUN_RADIUS_KM } from './bodies';
import type { Anchor, SpaceScene } from './space-scene';
import { v3 } from './shared';

/** Where each kind of anchor is, how big it is, and what it is called. */

export interface AnchorState { position: THREE.Vector3; radius: number }

/** A star or host is a point; this is how close the camera may come. */
const STAR_RADIUS_KM = 5e8;

/** Where `anchor` is now and how big it is; null until its data has arrived. */
export function anchorState(scene: SpaceScene, anchor: Anchor, jd: number): AnchorState | null {
  switch (anchor.kind) {
    case 'system': return { position: new THREE.Vector3(), radius: SUN_RADIUS_KM };
    case 'galaxy': return { position: v3(GALACTIC_CENTRE_KM), radius: 2_000 * LY_KM };
    case 'body': {
      const p = scene.bodyPos(anchor.key, jd);
      const r = anchor.key === 'sun' ? SUN_RADIUS_KM : SKY_BODIES.find(b => b.key === anchor.key)!.radiusKm;
      return p ? { position: v3(p), radius: r } : null;
    }
    case 'craft': {
      const c = scene.fleet.find(k => k.id === anchor.id);
      const p = c && scene.craftPosition(c, jd, scene.timeMs());
      return p ? { position: v3(p), radius: 1 } : null;
    }
    case 'star': {
      const p = scene.nearby.position(anchor.index);
      return p ? { position: p.clone(), radius: STAR_RADIUS_KM } : null;
    }
    case 'exohost': {
      const i = scene.nearby.hosts().findIndex(h => h.name === anchor.name);
      return i >= 0 ? { position: scene.nearby.hostPosition(i).clone(), radius: STAR_RADIUS_KM } : null;
    }
    case 'outer': {
      const b = scene.outer.bodies().find(x => x.key === anchor.key);
      const p = b && scene.outer.positionOf(b, jd);
      return b && p ? { position: new THREE.Vector3(...p), radius: Math.max(b.radiusKm, 1) } : null;
    }
    case 'feature': {
      const f = DEEP_FEATURES[anchor.id];
      if (f?.position) return { position: v3(f.position), radius: f.radiusKm ?? LY_KM };
      const s = anchor.id.startsWith('cosmos:') ? scene.cosmos.labels().find(l => l.id === anchor.id) : null;
      return s ? { position: s.position, radius: 5e6 * LY_KM } : null;
    }
  }
}

/** What the camera is anchored on, in words. */
export function anchorName(scene: SpaceScene): string {
  const a = scene.anchor;
  switch (a.kind) {
    case 'system': return scene.sunKm < 2_000 * AU_KM ? 'Solar system' : 'Sun';
    case 'galaxy': return 'Milky Way';
    case 'body': return SKY_BODIES.find(b => b.key === a.key)!.name;
    case 'craft': return scene.fleet.find(c => c.id === a.id)?.name ?? 'Spacecraft';
    case 'star': return scene.nearby.catalog()?.names[a.index] ?? scene.nearby.catalog()?.ids[a.index] ?? 'Star';
    case 'exohost': return a.name;
    case 'outer': return scene.outer.bodies().find(b => b.key === a.key)?.name ?? 'Outer solar system';
    case 'feature': return DEEP_FEATURES[a.id]?.name ?? 'Deep space';
  }
}
