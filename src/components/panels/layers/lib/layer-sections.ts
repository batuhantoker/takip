import { REFERENCE_GROUPS } from '@/lib/reference/catalog';
import type { LayerGroupDef } from '@/components/panels/layers/layer-groups';
import { filterLayerGroups } from './layer-search';
import { sentenceCase } from './sentence-case';

export interface LayerSection {
  id: string;
  title: string;
  groups: LayerGroupDef[];
  /** Name each source group above its rows. */
  subheadings: boolean;
}

interface SectionDef {
  id: string;
  title: string;
  /** Group `label`s, in display order. */
  groups: readonly string[];
  flat?: boolean;
}

/* Regroups LAYER_GROUPS for display only: peers keep adding groups there, and the
   layer keys are persisted, so neither the groups nor the keys change here. */
const SECTIONS: SectionDef[] = [
  { id: 'air', title: 'Air', groups: ['AVIATION'] },
  { id: 'sea', title: 'Sea', groups: ['MARITIME', 'SDK'], flat: true },
  { id: 'space', title: 'Space', groups: ['SPACE'] },
  { id: 'weather', title: 'Weather & hazards', groups: ['WEATHER', 'HAZARD'] },
  { id: 'conflict', title: 'Conflict & cyber', groups: ['THREAT', 'NETWORK', 'NETINTEL'] },
  { id: 'cameras', title: 'Cameras & media', groups: ['SURVEIL'] },
  { id: 'reference', title: 'Reference', groups: [...REFERENCE_GROUPS.map(g => g.label), 'OUTDOOR'] },
];

export const OTHER_SECTION_ID = 'other';

/** Map display settings; they live in the map options menu, not here. */
const EXCLUDED = new Set(['DISPLAY']);

/** Subheadings where the group's own name would be cryptic or overlap its neighbours. */
const GROUP_TITLES: Record<string, string> = {
  WEATHER: 'Weather',
  HAZARD: 'Natural hazards',
  THREAT: 'Incidents & threats',
  NETWORK: 'Malware & botnets',
  NETINTEL: 'Internet & services',
};

export const groupTitle = (group: LayerGroupDef) => GROUP_TITLES[group.label] ?? sentenceCase(group.fullLabel);

/** The section a group label belongs to; unknown labels land in Other, excluded ones get null. */
export function sectionFor(label: string): string | null {
  if (EXCLUDED.has(label)) return null;
  return SECTIONS.find(s => s.groups.includes(label))?.id ?? OTHER_SECTION_ID;
}

export function groupSections(groups: LayerGroupDef[]): LayerSection[] {
  const defs: SectionDef[] = [...SECTIONS, { id: OTHER_SECTION_ID, title: 'Other', groups: [] }];
  return defs.flatMap(def => {
    const rank = (g: LayerGroupDef) => def.groups.indexOf(g.label);
    const mine = groups.filter(g => sectionFor(g.label) === def.id).sort((a, b) => rank(a) - rank(b));
    if (!mine.length) return [];
    // "Other" says nothing on its own, so its groups are always named.
    const subheadings = def.id === OTHER_SECTION_ID || (!def.flat && mine.length > 1);
    return [{ id: def.id, title: def.title, groups: mine, subheadings }];
  });
}

/** A query naming a section ("sea", "weather") keeps all of it; otherwise layers are matched as in filterLayerGroups. */
export function filterSections(sections: LayerSection[], query: string): LayerSection[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return sections;
  return sections.flatMap(s => {
    const titleWords = s.title.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if (words.every(w => titleWords.some(t => t.startsWith(w)))) return [s];
    const groups = filterLayerGroups(s.groups, query);
    return groups.length ? [{ ...s, groups }] : [];
  });
}
