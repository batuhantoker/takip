/**
 * TAKIP — where everything in the space view is at a given moment, in the
 * scene frame (heliocentric ecliptic J2000, km), from the API payloads.
 */

import { add, GM_SUN } from './astro';
import type { FleetCraft, FrameKey } from './fleet';
import { bodyPoint, drift, earthOrientation, GM_EARTH, orientationFromLighting, stateAt, type Mat3 } from './frames';
import type { Vec3 } from './horizons';
import { SKY_BODIES, type SkyBody, type SkyKey, type SkyPayload } from './sky';
import { lightingAt, trackAt, type SurfaceOrbiter, type SurfacePayload } from './surface';
import type { GlobeWorldId } from './worlds';

const MU: Record<FrameKey, number> = {
  sun: GM_SUN, earth: GM_EARTH, moon: 4_902.8, mercury: 22_032, venus: 324_859,
  mars: 42_828, jupiter: 126_686_534, saturn: 37_931_187,
};

/** Past this, a craft orbiting a small body has gone round too often to extrapolate. */
const TIGHT_ORBIT_MAX_SEC = 3600;

export const RADIUS_KM: Record<SkyKey, number> = Object.fromEntries(SKY_BODIES.map(b => [b.key, b.radiusKm])) as Record<SkyKey, number>;

export class SpaceModel {
  bodies = new Map<SkyKey, SkyBody>();
  surfaces: Partial<Record<GlobeWorldId, SurfacePayload>> = {};
  fleetEpochJd = 0;

  setSky(p: SkyPayload) {
    this.bodies = new Map(p.bodies.map(b => [b.key, b]));
  }

  setSurface(p: SurfacePayload) {
    this.surfaces[p.body] = p;
  }

  bodyPos(key: SkyKey, jd: number): Vec3 | null {
    if (key === 'sun') return [0, 0, 0];
    const b = this.bodies.get(key);
    if (!b) return null;
    return b.states.length ? stateAt(b.states, jd) : b.helio;
  }

  /** Body-fixed to scene rotation, where it is known. */
  orientation(key: SkyKey, jd: number, ms: number): Mat3 | null {
    if (key === 'earth') return earthOrientation(jd);
    if (key !== 'moon' && key !== 'mars') return null;
    const light = lightingAt(this.surfaces[key]?.lighting ?? [], ms);
    const own = this.bodyPos(key, jd), earth = this.bodyPos('earth', jd);
    return light && own && earth ? orientationFromLighting(light.sun, light.earth, own, earth) : null;
  }

  craftPos(c: FleetCraft, jd: number): Vec3 | null {
    const base = c.frame === 'sun' ? [0, 0, 0] as Vec3 : this.bodyPos(c.frame, jd);
    if (!base) return null;
    const dt = (jd - this.fleetEpochJd) * 86_400;
    const tight = c.frame === 'moon' || c.frame === 'mars';
    return add(base, tight && Math.abs(dt) > TIGHT_ORBIT_MAX_SEC ? c.rel : drift(c.rel, c.relVel, dt, MU[c.frame]));
  }

  /** An orbiter over the Moon or Mars, body-fixed, from its ground track. */
  orbiterBodyFixed(world: GlobeWorldId, o: SurfaceOrbiter, ms: number): Vec3 | null {
    const p = trackAt(o.track, ms);
    return p ? bodyPoint(p.lat, p.lng, p.altKm, RADIUS_KM[world]) : null;
  }
}
