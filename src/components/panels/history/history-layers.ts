import type { ActiveLayers } from '@/lib/map/layers/defaults';
import { HISTORY_KEEPS } from '@/lib/map/layers/past';

/** What the map and the live pollers see while History is on; the Layers panel keeps the user's own choices. */
export function historyLayers(active: ActiveLayers): ActiveLayers {
  const out: Record<string, unknown> = { ...active };
  for (const [key, on] of Object.entries(active)) if (typeof on === 'boolean' && !HISTORY_KEEPS.has(key)) out[key] = false;
  // Not in DEFAULT_LAYERS, and drawn unless explicitly false.
  out.conflict_zones = false;
  return out as ActiveLayers;
}
