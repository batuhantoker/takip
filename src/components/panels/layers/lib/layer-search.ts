import type { LayerGroupDef } from '@/components/panels/layers/layer-groups';
import type { Translate } from '@/lib/core/i18n/translator';
import { sourceFor } from './layer-sources';

/**
 * Groups cut down to the layers matching every word of `query`. Sources and keys count too,
 * since they carry words the labels don't (`maritime_ships`, `sat_*`). A matched
 * sub-layer brings its parent along so it never shows detached. With `t`, the reader's language matches too.
 */
export function filterLayerGroups(groups: LayerGroupDef[], query: string, t?: Translate): LayerGroupDef[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return groups;
  return groups.flatMap(g => {
    const matched = g.layers.filter(l => {
      const source = sourceFor(l.key, l.description);
      const local = t ? [t(g.fullLabel), t(l.label), source && t(source)] : [];
      const text = [g.label, g.fullLabel, l.label, source, l.key, l.dataKey, ...local].join(' ').toLowerCase();
      return words.every(w => text.includes(w));
    });
    const parents = new Set(matched.map(l => l.parent));
    const layers = g.layers.filter(l => matched.includes(l) || parents.has(l.key));
    return layers.length ? [{ ...g, layers }] : [];
  });
}
