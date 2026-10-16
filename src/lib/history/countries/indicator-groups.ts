import { type CountryPick, VIEW_GROUPS } from './view';
import { baseCode, isProjectionCode } from '../projection';
import type { CatalogueMetric } from '../series';

/*
 * The indicator catalogue folded into groups a person would look under. WDI topics are paths
 * ("Health: Mortality"), OWID and WPP topics are slugs ("mental_health"); both land in the same groups.
 */

/** A catalogue metric, with the last year its projections reach when it has any. */
export type Indicator = CatalogueMetric & { projectedTo?: number };
export type IndicatorSection = { label: string | null; metrics: Indicator[] };
export type IndicatorGroup = { id: string; title: string; count: number; sections: IndicatorSection[] };

export const SUGGESTED = 'suggested';
const OTHER = 'Other';

/** [topic prefix, group, section]. The first match wins; without a section, the topic's next part is one. */
const RULES: [string, string, string?][] = [
  ['Health: Population: Structure', 'People', 'Population structure'],
  ['Health: Population: Dynamics', 'People', 'Population dynamics'],
  ['Health: Population', 'People', 'Population'],
  ['Health: Universal Health Coverage', 'Health', 'Universal health coverage'],
  ['Social Protection & Labor: Migration', 'People', 'Migration'],
  ['Environment: Density & urbanization', 'People', 'Density & urbanization'],
  ['Public Sector: Conflict & fragility', 'Conflict', 'Conflict & fragility'],
  ['Public Sector: Defense & arms trade', 'Conflict', 'Defense & arms trade'],
  ['Policy & institutions', 'Politics and government', 'Governance indicators'],
  ['Health', 'Health'],
  ['Economic Policy & Debt', 'Economy'],
  ['Poverty', 'Poverty and inequality'],
  ['Social Protection & Labor', 'Work and social protection'],
  ['Private Sector & Trade', 'Trade and business'],
  ['Trade', 'Trade and business'],
  ['Financial Sector', 'Finance'],
  ['Public Sector', 'Politics and government'],
  ['Education', 'Education'],
  ['Gender', 'Gender'],
  ['Infrastructure', 'Technology and infrastructure'],
  ['Environment', 'Environment and energy'],
  ['health', 'Health'],
  ['mental_health', 'Health', 'Mental health'],
  ['population', 'People'],
  ['people', 'People'],
  ['conflict', 'Conflict'],
  ['territorial', 'Conflict', 'Territorial claims'],
  ['politics', 'Politics and government'],
  ['economy', 'Economy'],
  ['education', 'Education'],
  ['environment', 'Environment and energy'],
];

const ORDER = ['Health', 'People', 'Conflict', 'Politics and government', 'Economy', 'Poverty and inequality', 'Work and social protection',
  'Trade and business', 'Finance', 'Education', 'Gender', 'Technology and infrastructure', 'Environment and energy'];

const SEP = ': ';

/** The group and section a topic files under. An unknown WDI area becomes its own group. */
export function placeOf(topic: string | null): { group: string; section: string | null } {
  if (!topic) return { group: OTHER, section: null };
  const parts = topic.split(SEP);
  for (const [prefix, group, section] of RULES) {
    const head = prefix.split(SEP);
    if (head.length > parts.length || head.some((p, i) => p !== parts[i])) continue;
    return { group, section: section ?? parts[head.length] ?? null };
  }
  return { group: parts[0], section: parts[1] ?? null };
}

const byName = (a: Indicator, b: Indicator) => a.name.localeCompare(b.name, 'en');

function rank(title: string) {
  if (title === OTHER) return Infinity;
  const i = ORDER.indexOf(title);
  return i < 0 ? ORDER.length : i;
}

/** Every metric in a group, groups in a fixed order; inside one, the untitled section first, then by name. */
export function groupIndicators(metrics: readonly Indicator[]): IndicatorGroup[] {
  const groups = new Map<string, Map<string | null, Indicator[]>>();
  for (const m of metrics) {
    const { group, section } = placeOf(m.topic);
    let sections = groups.get(group);
    if (!sections) groups.set(group, (sections = new Map()));
    const list = sections.get(section);
    if (list) list.push(m);
    else sections.set(section, [m]);
  }
  return [...groups]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, 'en'))
    .map(([title, sections]) => ({
      id: title,
      title,
      count: [...sections.values()].reduce((n, list) => n + list.length, 0),
      sections: [...sections]
        .sort(([a], [b]) => (a === null ? -1 : b === null ? 1 : a.localeCompare(b, 'en')))
        .map(([label, list]) => ({ label, metrics: list.sort(byName) })),
    }));
}

const pickLabel = (v: (typeof VIEW_GROUPS)[number]['views'][number]) => (v.projectedTo ? `${v.label}, projected to ${v.projectedTo}` : v.label);

/** Offered beside "Pick an indicator" before anything is picked: series most countries have, reaching today. */
export const STARTERS = ['wpp:LEx', 'wdi:NY.GDP.PCAP.KD', 'wpp:TPopulation1July'];

/** The picker's label for a curated pick, null for any other code. `short` leaves out "projected to", as the legend does. */
export function curatedLabel(code: string, short = false): string | null {
  const v = VIEW_GROUPS.flatMap(g => g.views).find(x => x.code === code);
  return v ? (short ? v.label : pickLabel(v)) : null;
}

const yearText = (y: number) => (y > 0 ? (y < 1000 ? `${y} CE` : String(y)) : `${(1 - y).toLocaleString('en')} BCE`);

/**
 * The years an indicator covers, "1960–2024"; early years say CE or BCE so "1–2022" isn't misread. Projections
 * past the last estimate are named as such: "1950–2023, projected to 2100".
 */
export function yearSpan([first, last]: readonly [number, number], projectedTo?: number): string {
  const a = Math.floor(first);
  const b = Math.floor(last);
  const span = a === b ? yearText(a) : `${yearText(a)}–${yearText(b)}`;
  return projectedTo !== undefined && projectedTo > b ? `${span}, projected to ${yearText(projectedTo)}` : span;
}

/** A label without its ", since 1543" or ", projected to 2100", for where the years are shown beside it. */
export const undated = (label: string) => label.replace(/, (since|projected to) .+$/, '');

/** The catalogue as the picker lists it: projections fold into the estimates they extend, as the reach of their years. */
export function withProjections(all: readonly CatalogueMetric[]): Indicator[] {
  const reach = new Map<string, number>();
  for (const m of all) {
    if (!isProjectionCode(m.code) || !m.years) continue;
    const base = baseCode(m.code);
    reach.set(base, Math.max(reach.get(base) ?? -Infinity, Math.floor(m.years[1])));
  }
  return all.filter(m => !isProjectionCode(m.code)).map(m => (reach.has(m.code) ? { ...m, projectedTo: reach.get(m.code) } : m));
}

/** A pick's name: its curated label, else the metric's own name once loaded, else its code. */
export const nameOf = (p: CountryPick, short = false) => curatedLabel(p.code, short) ?? (p.status === 'ready' ? p.data.metric.name : p.code);

/** The curated picks under their own headings and labels, leaving out any the catalogue doesn't carry. */
export function suggestedGroup(metrics: readonly Indicator[]): IndicatorGroup {
  const byCode = new Map(metrics.map(m => [m.code, m]));
  const sections = VIEW_GROUPS.map(g => ({
    label: g.label,
    metrics: g.views.flatMap(v => {
      const m = byCode.get(v.code);
      return m ? [{ ...m, name: pickLabel(v) }] : [];
    }),
  })).filter(s => s.metrics.length);
  return { id: SUGGESTED, title: 'Suggested', count: sections.reduce((n, s) => n + s.metrics.length, 0), sections };
}

/** Groups cut down to the metrics matching every word of `query`, in their name, code, group or section. */
export function filterIndicators(groups: readonly IndicatorGroup[], query: string): IndicatorGroup[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [...groups];
  return groups.flatMap(g => {
    const sections = g.sections.flatMap(s => {
      const context = `${g.title} ${s.label ?? ''}`;
      const hits = s.metrics.filter(m => {
        const text = `${context} ${m.name} ${m.code}`.toLowerCase();
        return words.every(w => text.includes(w));
      });
      return hits.length ? [{ ...s, metrics: hits }] : [];
    });
    const count = sections.reduce((n, s) => n + s.metrics.length, 0);
    return count ? [{ ...g, count, sections }] : [];
  });
}
