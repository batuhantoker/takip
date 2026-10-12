import type { ActiveLayers } from '@/lib/default-layers';

/** Display settings that still make sense in the past. Every data layer is today's, so History turns it off. */
const KEEP = new Set(['terrain_3d', 'terrain_elevation', 'sky_stars']);

/** What the map and the live pollers see while History is on; the Layers panel keeps the user's own choices. */
export function historyLayers(active: ActiveLayers): ActiveLayers {
  const out: Record<string, unknown> = { ...active };
  for (const [key, on] of Object.entries(active)) if (typeof on === 'boolean' && !KEEP.has(key)) out[key] = false;
  // Not in DEFAULT_LAYERS, and drawn unless explicitly false.
  out.conflict_zones = false;
  return out as ActiveLayers;
}
