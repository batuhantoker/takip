import type { SpaceFocus } from '@/lib/space/worlds';

/** A link that opens the map in one of its other views: History at a year, deep time, Space at a body, or Replay at a moment. */
export type ViewModeLink =
  | { view: 'history'; year: number | null; layer?: HistoryLayerLink | null; range?: { from: number; to: number }; families?: HistoryFamilyLink[] }
  | { view: 'deep'; ma: number | null; chapter: number | null }
  | { view: 'space'; focus: SpaceFocus }
  | { view: 'replay'; at: number | null };

/** History's border layers a link may switch on (lib/history/world-borders.ts, war-layers.ts). */
export const HISTORY_LAYERS = ['world-borders', 'ww2-europe'] as const;
export type HistoryLayerLink = (typeof HISTORY_LAYERS)[number];

/** History's event families a link may switch on (lib/history/popup.ts HISTORY_FAMILIES). */
export const HISTORY_FAMILY_LINKS = ['conflict', 'terror', 'territorial', 'heritage', 'hazard', 'politics', 'nuclear', 'disaster'] as const;
export type HistoryFamilyLink = (typeof HISTORY_FAMILY_LINKS)[number];

const FOCUS: readonly SpaceFocus[] = ['earth', 'moon', 'mars', 'sun', 'solar', 'stars', 'galaxy', 'universe'];

const int = (v: string | null, min: number, max: number) => {
  if (v === null || !/^-?\d{1,15}$/.test(v.trim())) return null;
  const n = Number(v);
  return n >= min && n <= max ? n : null;
};

/**
 * `?view=history&year=1914&layer=world-borders`, a span of years with `&from=1927&to=2026` and families with
 * `&families=hazard,disaster`; `?view=deep&ma=250` or `&chapter=3`, `?view=space&focus=mars`, `?view=replay&at=<epoch ms>`.
 */
export function parseViewModeLink(p: URLSearchParams, now = Date.now()): ViewModeLink | null {
  switch (p.get('view')) {
    case 'history': {
      const layer = p.get('layer');
      const thisYear = new Date(now).getUTCFullYear();
      const from = int(p.get('from'), -3000, thisYear);
      const to = int(p.get('to'), -3000, thisYear);
      const families = [...new Set((p.get('families') ?? '').split(','))].filter((f): f is HistoryFamilyLink => (HISTORY_FAMILY_LINKS as readonly string[]).includes(f));
      return {
        view: 'history',
        year: int(p.get('year'), -3000, thisYear),
        layer: layer && (HISTORY_LAYERS as readonly string[]).includes(layer) ? (layer as HistoryLayerLink) : null,
        ...(from !== null && to !== null && from <= to ? { range: { from, to } } : {}),
        ...(families.length ? { families } : {}),
      };
    }
    case 'deep': return { view: 'deep', ma: int(p.get('ma'), 0, 1000), chapter: int(p.get('chapter'), 0, 99) };
    case 'space': {
      const focus = p.get('focus') as SpaceFocus | null;
      return { view: 'space', focus: focus && FOCUS.includes(focus) ? focus : 'solar' };
    }
    case 'replay': {
      const at = int(p.get('at'), 0, now);
      return { view: 'replay', at };
    }
    default: return null;
  }
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
  if (link.view === 'deep' && link.chapter !== null) q.set('chapter', String(link.chapter));
  else if (link.view === 'deep' && link.ma !== null) q.set('ma', String(link.ma));
  if (link.view === 'space') q.set('focus', link.focus);
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
