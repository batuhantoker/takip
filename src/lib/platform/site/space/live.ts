import type { SurfacePayload, SurfaceRover } from '@/lib/space/bodies/surface';
import type { FleetCraft, FleetPayload } from '@/lib/space/craft/fleet';
import { C_KM_S, norm, sub } from '@/lib/space/astro';
import { outerPosition, type OuterPayload } from '@/lib/space/deep/outer';
import { jdFromMs } from '@/lib/space/horizons';
import { sampleAt, type SkyPayload } from '@/lib/space/sky';
import { ownApi } from '../live/own-api';

/**
 * TAKIP — what the space pages say about now, from the app's own space routes (JPL Horizons, NASA's rover
 * maps). Each answer carries the moment it is true for; a route that fails or is still warming up leaves it out.
 */

export type CraftNow = Pick<FleetCraft, 'id' | 'name' | 'cospar' | 'region' | 'sunKm' | 'earthKm' | 'lightSec' | 'speedKmS' | 'speedFrame'>;

export interface FleetNow { at: number; craft: CraftNow[] }

export interface PlanetNow { at: number; earthKm: number; sunKm: number; lightSec: number; /** km a day, negative while closing in. */ trendKmDay: number | null }

export type RoverNow = Omit<SurfaceRover, 'traverse'> & { at: number };

export async function fleetNow(): Promise<FleetNow | null> {
  const p = await ownApi<FleetPayload>('/api/space/fleet', 900);
  const at = p ? Date.parse(p.epoch) : NaN;
  if (!p?.craft?.length || !Number.isFinite(at)) return null;
  // The trails are most of the payload; pages need only where each craft is.
  return {
    at,
    craft: p.craft.map(c => ({
      id: c.id, name: c.name, cospar: c.cospar, region: c.region, sunKm: c.sunKm, earthKm: c.earthKm, lightSec: c.lightSec, speedKmS: c.speedKmS, speedFrame: c.speedFrame,
    })),
  };
}

export async function planetNow(key: string, now = Date.now()): Promise<PlanetNow | null> {
  const p = await ownApi<SkyPayload>('/api/space/sky', 1800);
  const b = p?.bodies?.find(x => x.key === key);
  const s = b && sampleAt(b.track, jdFromMs(now));
  if (!b || !s) return null;
  const first = b.track[0], last = b.track[b.track.length - 1];
  const days = last && first ? last.jd - first.jd : 0;
  return {
    at: now,
    earthKm: s.km,
    sunKm: norm(b.helio),
    lightSec: s.km / C_KM_S,
    trendKmDay: days > 0.5 ? (last.km - first.km) / days : null,
  };
}

/** A dwarf planet or interstellar visitor now, from the space view's own outer payload and Earth's place in the sky one. */
export async function outerNow(key: string, now = Date.now()): Promise<PlanetNow | null> {
  const [outer, sky] = await Promise.all([ownApi<OuterPayload>('/api/space/outer', 3600), ownApi<SkyPayload>('/api/space/sky', 1800)]);
  const b = outer?.bodies.find(x => x.key === key);
  const earth = sky?.bodies?.find(x => x.key === 'earth');
  const p = outer && b ? outerPosition(b, jdFromMs(now), jdFromMs(Date.parse(outer.epoch))) : null;
  if (!p || !earth) return null;
  const earthKm = norm(sub(p, earth.helio));
  // Over a day Earth's own motion swamps the change, so no trend is claimed.
  return { at: now, earthKm, sunKm: norm(p), lightSec: earthKm / C_KM_S, trendKmDay: null };
}

export async function marsRovers(): Promise<RoverNow[]> {
  const p = await ownApi<SurfacePayload>('/api/space/surface/mars', 600);
  const at = p ? Date.parse(p.epoch) : NaN;
  if (!p?.rovers?.length || !Number.isFinite(at)) return [];
  return p.rovers.map(r => ({ key: r.key, name: r.name, agency: r.agency, sol: r.sol, lat: r.lat, lng: r.lng, driveKm: r.driveKm, at }));
}
