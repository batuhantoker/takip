import { Landmark, PlaneLanding, TrainFront, Waves } from 'lucide-react';
import { REFERENCE_DATASETS, REFERENCE_GROUPS, type ReferenceGroupId } from '@/lib/reference/catalog';

const ICONS: Record<ReferenceGroupId, typeof Landmark> = {
  airfields: PlaneLanding,
  rail_road: TrainFront,
  waterways: Waves,
  sites: Landmark,
};

/**
 * The reference-data layer groups, shaped like the layer panel's own groups.
 * Each row requires the `reference` capability, which the page sets from
 * /api/reference, so deployments without data/reference/ show none of them.
 */
export const REFERENCE_LAYER_GROUPS = REFERENCE_GROUPS.map(g => ({
  label: g.label,
  fullLabel: g.fullLabel,
  icon: ICONS[g.id],
  layers: REFERENCE_DATASETS.filter(d => d.group === g.id).map(d => ({
    key: d.key,
    label: d.label,
    description: d.description,
    dataKey: '',
    requires: 'reference',
  })),
}));
