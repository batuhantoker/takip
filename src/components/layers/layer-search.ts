import type { LayerGroupDef } from './layer-groups';

/**
 * Groups cut down to the layers matching every word of `query`. Keys count too,
 * since they carry words the labels don't (`maritime_ships`, `sat_*`). A matched
 * sub-layer brings its parent along so it never shows detached.
 */
export function filterLayerGroups(groups: LayerGroupDef[], query: string): LayerGroupDef[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return groups;
  return groups.flatMap(g => {
    const matched = g.layers.filter(l => {
      const text = [g.label, g.fullLabel, l.label, l.description, l.key, l.dataKey].join(' ').toLowerCase();
      return words.every(w => text.includes(w));
    });
    const parents = new Set(matched.map(l => l.parent));
    const layers = g.layers.filter(l => matched.includes(l) || parents.has(l.key));
    return layers.length ? [{ ...g, layers }] : [];
  });
}
