import { leadSentences } from '@/lib/core/wikipedia/summary';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import type { ViewModeLink } from '@/lib/map/view-mode-link';
import { LY_KM } from '@/lib/space/astro';
import { BASINS, NEARBY_VOIDS } from '@/lib/space/deep/basins.generated';
import { nearbyVoidId } from '@/lib/space/deep/cosmic-web';
import { DEEP_FEATURES, type DeepFeature } from '@/lib/space/deep/features';
import { STRUCTURES } from '@/lib/space/deep/structures';
import { wikiTopic } from '@/lib/space/wiki-topic';
import { mapHref } from '../map-link';
import { descriptionMax, fit, titleMax } from './copy';
import { lightYearsText } from './sky-pages';

/**
 * TAKIP — the large-scale universe's pages, at /deep-sky/<id> beside the telescope pictures': Laniakea and the basins
 * round it, the named clusters, superclusters and walls, the voids, and the microwave background. Each is a feature
 * of the space view (lib/space/deep/features.ts), with the id its 3D link selects.
 */

export type StructureGroup = 'basins' | 'clusters' | 'voids' | 'edge';

export interface StructurePage {
  id: string;
  feature: DeepFeature;
  group: StructureGroup;
  /** From the Sun: to a basin's attractor, else to the thing itself. */
  ly: number;
  /** English Wikipedia title, where it has an article of its own. */
  wiki: string | null;
}

export const STRUCTURE_GROUPS: { id: StructureGroup; label: string }[] = [
  { id: 'basins', label: msg('Superclusters and their basins') },
  { id: 'clusters', label: msg('Galaxy clusters and great walls') },
  { id: 'voids', label: msg('Voids') },
  { id: 'edge', label: msg('The edge of what can be seen') },
];

const CMB_LY = 45.3e9;

function page(id: string, group: StructureGroup): StructurePage {
  const feature = DEEP_FEATURES[id];
  const basin = BASINS.find(b => b.id === id);
  const ly = id === 'cmb' ? CMB_LY : basin ? Math.hypot(...basin.core) * 1e6 : Math.hypot(...feature.position!) / LY_KM;
  const topic = wikiTopic({ kind: 'feature', id });
  const wiki = topic && 'title' in topic && topic.title && topic.title !== 'Void (astronomy)' ? topic.title : null;
  return { id, feature, group, ly, wiki };
}

const byDistance = (a: StructurePage, b: StructurePage) => a.ly - b.ly;

export const STRUCTURE_PAGES: StructurePage[] = [
  ...BASINS.filter(b => b.kind === 'attraction').map(b => page(b.id, 'basins')),
  ...STRUCTURES.filter(s => s.kind !== 'void').map(s => page(s.id, 'clusters')).sort(byDistance),
  ...[...STRUCTURES.filter(s => s.kind === 'void').map(s => s.id), ...BASINS.filter(b => b.kind === 'repulsion').map(b => b.id), ...NEARBY_VOIDS.map((_, k) => nearbyVoidId(k))]
    .map(id => page(id, 'voids')).sort(byDistance),
  page('cmb', 'edge'),
];

export const structurePage = (slug: string): StructurePage | null => STRUCTURE_PAGES.find(p => p.id === slug) ?? null;

export const groupPages = (group: StructureGroup, except?: string) => STRUCTURE_PAGES.filter(p => p.group === group && p.id !== except);

/** Into the space view, flown to it and its card open. */
export const structureHref = (p: StructurePage) =>
  mapHref({ layers: [], mode: { view: 'space', focus: 'universe', select: { kind: 'feature', id: p.id } } satisfies ViewModeLink });

export function structureTitle(t: Translate, p: StructurePage): string {
  const name = t(p.feature.name);
  return fit([t('{name}: where it is and how far, in 3D', { name }), t('{name}: how far it is, in 3D', { name }), name], titleMax(t));
}

/** Its own note's first sentence leads; the tail says how far it is and that it is drawn from survey data. */
export function structureDescription(t: Translate, p: StructurePage, wikiLead: string | null): string {
  const max = descriptionMax(t);
  const name = t(p.feature.name);
  const distance = lightYearsText(t, p.ly);
  const long = t('{distance} from the Sun, drawn from survey data in 3D.', { distance });
  const short = t('{distance} from the Sun; see it in 3D.', { distance });
  const text = p.feature.note ? t(p.feature.note) : wikiLead ?? '';
  const first = text.match(/^.+?[.!?。！？](?=\s|$)/u)?.[0] ?? '';
  const candidates = [first && `${first} ${long}`, first && `${first} ${short}`, `${name}: ${long}`, `${name}: ${short}`].filter(Boolean);
  return candidates.find(d => [...d].length <= max) ?? leadSentences(candidates[candidates.length - 1], max);
}
