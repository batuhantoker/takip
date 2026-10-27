import { KIND_FAMILY } from '@/lib/history/kinds';
import { DEEP_FEATURES } from '@/lib/space/deep/features';
import { DWARF_PLANETS, VISITORS } from '@/lib/space/deep/outer';
import type { SpaceSelection } from '@/lib/space/selection';
import { SKY_BODIES } from '@/lib/space/sky';
import type { SpaceFocus } from '@/lib/space/worlds';

/** A link that opens the map in one of its other views: History at a year, deep time, Space at a body, or Replay at a moment. */
export type ViewModeLink =
  | {
    view: 'history'; year: number | null; layer?: HistoryLayerLink | null; range?: { from: number; to: number }; families?: HistoryFamilyLink[];
    /** Only these event kinds (lib/history/kinds.ts), their families switched on. */
    kinds?: string[];
    /** Countries coloured by a History metric, from `source` where several publish it, with up to four countries (countries.json `id`) charted. */
    metric?: string; source?: string; countries?: string[];
  }
  | { view: 'deep'; ma: number | null; chapter: number | null }
  | {
    view: 'space'; focus: SpaceFocus;
    /** Something to select on arrival: a craft, a Mars rover, a landing site, a body or a deep-sky feature. */
    select?: SpaceSelection;
    /** A spacecraft (Horizons ID) whose flight to play back. */
    replay?: number;
  }
  | { view: 'replay'; at: number | null };

/** History's border layers a link may switch on (lib/history/world-borders.ts, war-layers.ts). */
export const HISTORY_LAYERS = ['world-borders', 'ww2-europe'] as const;
export type HistoryLayerLink = (typeof HISTORY_LAYERS)[number];

/** History's event families a link may switch on (lib/history/popup.ts HISTORY_FAMILIES). */
export const HISTORY_FAMILY_LINKS = ['conflict', 'terror', 'territorial', 'heritage', 'hazard', 'politics', 'nuclear', 'disaster', 'crime', 'space', 'missile', 'slavery', 'events'] as const;
export type HistoryFamilyLink = (typeof HISTORY_FAMILY_LINKS)[number];

const FOCUS: readonly SpaceFocus[] = ['earth', 'moon', 'mars', 'sun', 'solar', 'stars', 'galaxy', 'universe'];
const HORIZONS_CRAFT = /^-\d{1,9}$/;
const ROVER = /^[a-z]{2,20}$/;
const SITE = /^(moon|mars):([a-z0-9-]{1,40})$/;

/** History's metric codes ("wpp:LEx", "wdi:NY.GDP.PCAP.KD"), source codes ("owid-le") and countries.json ids ("TUR", "SDS"). */
const METRIC = /^[a-z][a-z0-9-]{0,15}:[A-Za-z0-9_.]{1,48}$/;
const SOURCE = /^[a-z0-9][a-z0-9-]{0,31}$/;
const COUNTRY = /^[A-Z]{3}$/;
/** As many as a link charts; the chart itself takes six. */
export const MAX_LINK_COUNTRIES = 4;

const matching = (v: string | null, pattern: RegExp) => (v !== null && pattern.test(v) ? v : null);

const int = (v: string | null, min: number, max: number) => {
  if (v === null || !/^-?\d{1,15}$/.test(v.trim())) return null;
  const n = Number(v);
  return n >= min && n <= max ? n : null;
};

/**
 * `?view=history&year=1914&layer=world-borders`, a span of years with `&from=1927&to=2026`, families with
 * `&families=hazard,disaster`, only some kinds with `&kinds=accident.aviation,accident.rail` and countries coloured
 * with `&metric=wpp:LEx&source=wpp-2024&country=GRC,TUR`;
 * `?view=deep&ma=250` or `&chapter=3`, `?view=space&focus=mars` (with `&craft=-76` and the like, or `&replay=-31`),
 * `?view=replay&at=<epoch ms>`.
 */
export function parseViewModeLink(p: URLSearchParams, now = Date.now()): ViewModeLink | null {
  switch (p.get('view')) {
    case 'history': {
      const layer = p.get('layer');
      const thisYear = new Date(now).getUTCFullYear();
      const from = int(p.get('from'), -3000, thisYear);
      const to = int(p.get('to'), -3000, thisYear);
      const families = [...new Set((p.get('families') ?? '').split(','))].filter((f): f is HistoryFamilyLink => (HISTORY_FAMILY_LINKS as readonly string[]).includes(f));
      const kinds = [...new Set((p.get('kinds') ?? '').split(','))].filter(k => Object.hasOwn(KIND_FAMILY, k));
      const metric = matching(p.get('metric'), METRIC);
      const source = metric && matching(p.get('source'), SOURCE);
      const countries = metric ? [...new Set((p.get('country') ?? '').split(','))].filter(c => COUNTRY.test(c)).slice(0, MAX_LINK_COUNTRIES) : [];
      return {
        view: 'history',
        year: int(p.get('year'), -3000, thisYear),
        layer: layer && (HISTORY_LAYERS as readonly string[]).includes(layer) ? (layer as HistoryLayerLink) : null,
        ...(from !== null && to !== null && from <= to ? { range: { from, to } } : {}),
        ...(families.length ? { families } : {}),
        ...(kinds.length ? { kinds } : {}),
        ...(metric ? { metric } : {}),
        ...(source ? { source } : {}),
        ...(countries.length ? { countries } : {}),
      };
    }
    case 'deep': return { view: 'deep', ma: int(p.get('ma'), 0, 1000), chapter: int(p.get('chapter'), 0, 99) };
    case 'space': {
      const focus = p.get('focus') as SpaceFocus | null;
      const select = spaceSelect(p);
      const replay = matching(p.get('replay'), HORIZONS_CRAFT);
      return {
        view: 'space', focus: focus && FOCUS.includes(focus) ? focus : 'solar',
        ...(select ? { select } : {}),
        ...(replay ? { replay: Number(replay) } : {}),
      };
    }
    case 'replay': {
      const at = int(p.get('at'), 0, now);
      return { view: 'replay', at };
    }
    default: return null;
  }
}

/** `&craft=-76`, `&rover=curiosity`, `&site=mars:viking-1`, `&body=jupiter` or `&feature=pillars-of-creation`. */
function spaceSelect(p: URLSearchParams): SpaceSelection | null {
  const craft = matching(p.get('craft'), HORIZONS_CRAFT);
  if (craft) return { kind: 'craft', id: Number(craft) };
  const rover = matching(p.get('rover'), ROVER);
  if (rover) return { kind: 'rover', id: rover };
  const site = SITE.exec(p.get('site') ?? '');
  if (site) return { kind: 'site', world: site[1] as 'moon' | 'mars', id: site[2] };
  const feature = p.get('feature');
  if (feature && Object.hasOwn(DEEP_FEATURES, feature)) return { kind: 'feature', id: feature };
  const outer = [...DWARF_PLANETS, ...VISITORS].find(b => b.key === p.get('outer'));
  if (outer) return { kind: 'outer', key: outer.key };
  const body = SKY_BODIES.find(b => b.key === p.get('body'));
  return body ? { kind: 'body', key: body.key } : null;
}

/** 1 January of a year as epoch ms; years 0–99 included, which Date.UTC would read as 1900–1999. */
export function yearStart(year: number): number {
  const d = new Date(0);
  d.setUTCFullYear(year, 0, 1);
  return d.getTime();
}

export function viewModeQuery(link: ViewModeLink): string {
  const q = new URLSearchParams({ view: link.view });
  if (link.view === 'history' && link.year !== null) q.set('year', String(link.year));
  if (link.view === 'history' && link.layer) q.set('layer', link.layer);
  if (link.view === 'history' && link.range) {
    q.set('from', String(link.range.from));
    q.set('to', String(link.range.to));
  }
  if (link.view === 'history' && link.families?.length) q.set('families', link.families.join(','));
  if (link.view === 'history' && link.kinds?.length) q.set('kinds', link.kinds.join(','));
  if (link.view === 'history' && link.metric) {
    q.set('metric', link.metric);
    if (link.source) q.set('source', link.source);
    if (link.countries?.length) q.set('country', link.countries.join(','));
  }
  if (link.view === 'deep' && link.chapter !== null) q.set('chapter', String(link.chapter));
  else if (link.view === 'deep' && link.ma !== null) q.set('ma', String(link.ma));
  if (link.view === 'space') q.set('focus', link.focus);
  if (link.view === 'space' && link.select) {
    const s = link.select;
    if (s.kind === 'craft') q.set('craft', String(s.id));
    else if (s.kind === 'rover') q.set('rover', s.id);
    else if (s.kind === 'site') q.set('site', `${s.world}:${s.id}`);
    else if (s.kind === 'body') q.set('body', s.key);
    else if (s.kind === 'feature') q.set('feature', s.id);
    else if (s.kind === 'outer') q.set('outer', s.key);
  }
  if (link.view === 'space' && link.replay !== undefined) q.set('replay', String(link.replay));
  if (link.view === 'replay' && link.at !== null) q.set('at', String(link.at));
  return q.toString();
}

/** The sidebar panels a link can open, by the names people know them by. */
export const PANELS = ['layers', 'alerts', 'areas', 'route', 'recon', 'arcgis', 'ti', 'space'] as const;
export type PanelLink = (typeof PANELS)[number];

/** `?panel=route` and the like. */
export function parsePanelLink(p: URLSearchParams): PanelLink | null {
  const v = p.get('panel');
  return v && (PANELS as readonly string[]).includes(v) ? (v as PanelLink) : null;
}
