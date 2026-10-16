import { layerEntitlement, MAP_LAYER_SECTIONS, type Entitlements, type MapLayerSection } from '@takip/core/entitlements';
import { LAYER_GROUPS } from '@/components/panels/layers/layer-groups';
import { groupSections, sectionFor } from './layer-sections';

const isPlanSection = (id: string | null): id is MapLayerSection => (MAP_LAYER_SECTIONS as readonly string[]).includes(id ?? '');

// Display toggles and groups that land in Other belong to no plan section, so no plan can close them.
const SECTION_OF = new Map(LAYER_GROUPS.flatMap(g => {
  const section = sectionFor(g.label);
  return isPlanSection(section) ? g.layers.map(l => [l.key, section] as const) : [];
}));

const TITLES = new Map(groupSections(LAYER_GROUPS).map(s => [s.id, s.title]));

/** The plan section a layer key belongs to, if any. */
export const layerSection = (key: string): MapLayerSection | undefined => SECTION_OF.get(key);

export const sectionTitle = (section: MapLayerSection) => TITLES.get(section) ?? section;

/** Layer keys in the sections the plan closes. */
export function closedLayerKeys(entitlements: Entitlements): Set<string> {
  const closed = new Set(MAP_LAYER_SECTIONS.filter(s => !entitlements[layerEntitlement(s)]));
  return new Set([...SECTION_OF].filter(([, section]) => closed.has(section)).map(([key]) => key));
}

/** `layers` with every closed key off; the same object when nothing changes. */
export function withoutClosed<T extends Record<string, boolean>>(layers: T, closed: ReadonlySet<string>): T {
  if (![...closed].some(key => layers[key])) return layers;
  return { ...layers, ...Object.fromEntries([...closed].filter(key => key in layers).map(key => [key, false])) };
}
