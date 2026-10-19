import { REFERENCE_GROUPS } from '@/lib/feeds/reference/catalog';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import type { LayerGroupDef } from '@/components/panels/layers/layer-groups';
import { filterLayerGroups } from './layer-search';
import { localLabel, sentenceCase } from './sentence-case';

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
  { id: 'air', title: msg('Air'), groups: ['AVIATION'] },
  { id: 'sea', title: msg('Sea'), groups: ['MARITIME', 'SDK'], flat: true },
  { id: 'land', title: msg('Land'), groups: ['TRANSIT', 'ROADS'] },
  { id: 'space', title: msg('Space'), groups: ['SPACE'] },
  { id: 'weather', title: msg('Weather & hazards'), groups: ['WEATHER', 'HAZARD'] },
  { id: 'conflict', title: msg('Conflict & cyber'), groups: ['THREAT', 'NETWORK', 'NETINTEL'] },
  { id: 'cameras', title: msg('Cameras & media'), groups: ['SURVEIL'] },
  { id: 'reference', title: msg('Reference'), groups: [...REFERENCE_GROUPS.map(g => g.label), 'OUTDOOR'] },
];

export const OTHER_SECTION_ID = 'other';

/** Map display settings; they live in the map options menu, not here. */
const EXCLUDED = new Set(['DISPLAY']);

/** Subheadings where the group's own name would be cryptic or overlap its neighbours. */
const GROUP_TITLES: Record<string, string> = {
  WEATHER: msg('Weather'),
  HAZARD: msg('Natural hazards'),
  THREAT: msg('Incidents & threats'),
  NETWORK: msg('Malware & botnets'),
  NETINTEL: msg('Internet & services'),
};

/** The group's subheading, in the reader's language when given `t`. */
export function groupTitle(group: LayerGroupDef, t?: Translate): string {
  const title = GROUP_TITLES[group.label];
  if (title) return t ? t(title) : title;
  return t ? localLabel(group.fullLabel, t) : sentenceCase(group.fullLabel);
}

/** The section a group label belongs to; unknown labels land in Other, excluded ones get null. */
export function sectionFor(label: string): string | null {
  if (EXCLUDED.has(label)) return null;
  return SECTIONS.find(s => s.groups.includes(label))?.id ?? OTHER_SECTION_ID;
}

export function groupSections(groups: LayerGroupDef[]): LayerSection[] {
  const defs: SectionDef[] = [...SECTIONS, { id: OTHER_SECTION_ID, title: msg('Other'), groups: [] }];
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
export function filterSections(sections: LayerSection[], query: string, t?: Translate): LayerSection[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return sections;
  return sections.flatMap(s => {
    const titleWords = [s.title, t?.(s.title) ?? ''].join(' ').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    if (words.every(w => titleWords.some(tw => tw.startsWith(w)))) return [s];
    const groups = filterLayerGroups(s.groups, query, t);
    return groups.length ? [{ ...s, groups }] : [];
  });
}
