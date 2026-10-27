import * as THREE from 'three';
import { LY_KM } from '@/lib/space/astro';
import { DEEP_SKY_PLACED, PICTURED_IN } from '@/lib/space/deep/deep-sky';
import type { Vec3 } from '@/lib/space/horizons';
import { SUN_RADIUS_KM } from './bodies/planets';
import { rotation } from './shared';
import type { SpaceScene } from './space-scene';
import { ramp, type TierFades } from './tiers';

export function placeBodies(scene: SpaceScene, jd: number, ms: number): Vec3 | null {
  const earthPos = scene.bodyPos('earth', jd);

  for (const [key, p] of scene.planets) {
    const pos = scene.bodyPos(key, jd);
    p.group.visible = !!pos;
    if (!pos) continue;
    p.group.position.set(pos[0], pos[1], pos[2]);
    // Live, the Moon and Mars turn by today's lighting tables; a replay uses the IAU rotation model, as its landers do.
    const o = scene.replay ? scene.replay.model.orientation(key, jd) : scene.model.orientation(key, jd, ms);
    if (o) rotation(o, p.spin.matrix);
    p.spin.matrixWorldNeedsUpdate = true;
  }
  if (earthPos) {
    scene.earth.sunDir.set(-earthPos[0], -earthPos[1], -earthPos[2]).normalize();
    scene.orbits.moonFrame.position.set(earthPos[0], earthPos[1], earthPos[2]);
  }
  if (!scene.replay) {
    scene.surfaces.moon.update(ms);
    scene.surfaces.mars.update(ms);
  }
  return earthPos;
}

/** A body this many pixels across, in radius, gets its surface picture and, for the Moon and Mars, its landing sites. */
const TEXTURE_PX = 4;

export function fitToDistance(scene: SpaceScene, jd: number, sunDist: number, f: TierFades, heightPx: number) {
  const cam = scene.camera.position;
  // Orbits and trails fade in from ~100,000 km out to ~10 million: across the solar system they guide, beside a moon they clutter.
  const fade = Math.max(0.06, Math.min(1, (Math.log10(Math.max(1, cam.distanceTo(scene.rig.controls.target))) - 5) / 2));
  scene.orbits.fade(fade * f.planets, scene.selection?.kind === 'body' ? scene.selection.key : undefined);
  scene.craft.fade(scene.replay ? 0 : fade * f.craft);
  scene.craft.points.visible = (scene.layers.fleet || !!scene.replay) && f.craft > 0.01;

  scene.sun.showFrame(!scene.replay);
  scene.sun.sdo.quaternion.copy(scene.camera.quaternion);
  scene.sun.fit(sunDist);
  // From the outer planets the Sun must still read as the brightest thing in the sky;
  // up close the SDO frame carries the corona, and a full glow would wash it out.
  // Past the heliopause it shrinks to a star, and the 3D star field's Sun takes over.
  const glowAngle = sunDist < 1e10 ? 0.06 : Math.max(0.004, 0.06 * Math.pow(1e10 / sunDist, 0.4));
  scene.sun.glow.scale.setScalar(Math.max(SUN_RADIUS_KM * 3, sunDist * glowAngle));
  (scene.sun.glow.material as THREE.SpriteMaterial).opacity = Math.min(1, Math.max(0.3, sunDist / 3e7)) * (f.stars > 0 ? 1 - ramp(sunDist, 0.05 * LY_KM, 0.5 * LY_KM) : 1);
  const pxPerRad = heightPx / 2 / Math.tan((scene.camera.fov * Math.PI) / 360);
  for (const p of scene.planets.values()) {
    const d = p.group.position.distanceTo(cam);
    if ((p.def.radiusKm / d) * pxPerRad > TEXTURE_PX) scene.near(p.def.key);
    // A planet's dot hides once it would sit on the Sun's, a few pixels from it.
    p.marker.visible = (p.def.radiusKm / d) * pxPerRad < 3 && (p.group.position.length() / sunDist) * pxPerRad > 4;
    if (p.def.key === 'earth') scene.earth.scaleForDistance(d);
  }

  scene.backdrop?.update(scene.camera, f.backdrop);
  scene.outer.update(jd, f.outer, f.belt, !!scene.replay, scene.selection?.kind === 'outer' ? scene.selection.key : undefined);
  scene.heliosphere.update(f.heliosphere, scene.layers.illustrations);
  scene.oort.update(sunDist, f.oort, scene.layers.illustrations);
  scene.galactic.update(f.galactic);
  scene.nearby.update(f.stars, f.starFloor, scene.layers.constellations ? f.figures : 0, scene.layers.exoplanets, 0.35 + 0.65 * ramp(sunDist, 2_000 * LY_KM, 300 * LY_KM));
  scene.milkyWay.update(scene.camera, f.milkyWaySky, f.disc, scene.layers.illustrations);
  scene.localGroup.update(f.localGroup, id => scene.deepSky.shown(PICTURED_IN[id] ?? id));
  const labelled = scene.layers.labels ? 1 : 0;
  scene.deepSky.update(scene.camera, heightPx, () => (scene.layers.deepSky ? f.deepSky : 0), i => labelled * (DEEP_SKY_PLACED[i].object.realm === 'milky-way' ? f.deepSkyNear : f.deepSkyFar));
  scene.cosmos.update(f.localGalaxies, f.deepGalaxies, f.cmb, sunDist, scene.camera, scene.layers.illustrations);
  const sel = scene.selection;
  scene.web.update(f.web, f.farVoids, sunDist, scene.camera, heightPx, sel?.kind === 'feature' ? sel.id : null);
}
