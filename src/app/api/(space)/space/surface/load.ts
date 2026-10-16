import { cachedSource } from '@/lib/core/net/source-cache';
import type { SurfacePayload } from '@/lib/space/bodies/surface';
import type { GlobeWorldId } from '@/lib/space/worlds';
import { collectLighting, collectOrbiters, collectRovers } from './collect';

// Ground tracks run three hours ahead, so an hourly refresh keeps one under the marker.
const orbiters = {
  moon: cachedSource('space:orbiters:moon', () => collectOrbiters('moon'), 3_600_000),
  mars: cachedSource('space:orbiters:mars', () => collectOrbiters('mars'), 3_600_000),
};
const rovers = cachedSource('space:rovers:mars', collectRovers, 3 * 3_600_000);
const lighting = {
  moon: cachedSource('space:lighting:moon', () => collectLighting('moon'), 3_600_000),
  mars: cachedSource('space:lighting:mars', () => collectLighting('mars'), 3_600_000),
};

export async function loadSurface(body: GlobeWorldId): Promise<SurfacePayload> {
  const [o, r, l] = await Promise.all([orbiters[body](), body === 'mars' ? rovers() : Promise.resolve([]), lighting[body]()]);
  return { body, epoch: new Date().toISOString(), orbiters: o, rovers: r, lighting: l };
}
