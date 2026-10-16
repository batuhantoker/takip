import type { ActiveLayers } from '@/lib/map/layers/defaults';
import { needsLive } from '@/lib/map/layers/past';

/**
 * What the map and the live pollers see in Replay: the traffic it recorded and the reference layers that still hold.
 * Live-only layers such as temperature wait for LIVE rather than paint today's data over a past clock.
 */
export function replayLayers(active: ActiveLayers): ActiveLayers {
  const out: Record<string, unknown> = { ...active };
  for (const [key, on] of Object.entries(active)) if (typeof on === 'boolean' && needsLive(key, 'replay')) out[key] = false;
  // Not in DEFAULT_LAYERS, and drawn unless explicitly false.
  out.conflict_zones = false;
  return out as ActiveLayers;
}
