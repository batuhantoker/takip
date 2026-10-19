/**
 * The map page's layout as the person has set it: what is hidden, and where the movable pieces sit.
 * The defaults are the page as designed (docs/design/README.md, Layout). Phones keep their own copy.
 */

export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export const CORNERS: readonly Corner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

/** Which way a piece's menu opens from its corner: toward the middle of the map. */
export function towardMiddle(corner: Corner) {
  const top = corner.startsWith('top'), left = corner.endsWith('left');
  return {
    vertical: top ? 'bottom' as const : 'top' as const,
    sideways: left ? 'right' as const : 'left' as const,
    /** Lined up with the corner's side, or its edge for a menu opening sideways. */
    alongSide: left ? 'start' as const : 'end' as const,
    alongEdge: top ? 'start' as const : 'end' as const,
  };
}

export const RAIL_IDS = ['layers', 'alerts', 'draw', 'history', 'space', 'directions', 'recon', 'arcgis'] as const;
export type RailId = (typeof RAIL_IDS)[number];

export const STATUS_IDS = ['position', 'place', 'quake', 'live', 'tracked', 'clock', 'shortcuts'] as const;
export type StatusId = (typeof STATUS_IDS)[number];
export type Side = 'left' | 'right';

export const OVERLAY_IDS = ['search', 'showing', 'switcher', 'controls', 'scale'] as const;
export type OverlayId = (typeof OVERLAY_IDS)[number];

export const CONTROL_IDS = ['zoom', 'globe', 'basemap', 'replay'] as const;
export type ControlId = (typeof CONTROL_IDS)[number];

export const BAR_IDS = ['layers', 'intel', 'history', 'space', 'recon', 'ai', 'search', 'route'] as const;
export type BarId = (typeof BAR_IDS)[number];

/** A phone keeps its pieces in place; these are the ones it can hide. */
export const PHONE_OVERLAY_IDS = ['showing', 'switcher', 'controls'] as const;
type PhoneOverlayId = (typeof PHONE_OVERLAY_IDS)[number];

export type DesktopPiece = `rail:${RailId | 'ai'}` | 'statusbar' | `status:${StatusId}` | `overlay:${OverlayId}` | `control:${ControlId}`;
export type PhonePiece = `bar:${BarId}` | `overlay:${PhoneOverlayId}` | 'logo';
export type Piece = DesktopPiece | PhonePiece;
export type Form = 'desktop' | 'phone';

/** A piece placed by hand: its nearest corner, and how far in from that corner's two edges, in px. */
export interface FreeSpot {
  corner: Corner;
  x: number;
  y: number;
}

export interface DesktopLayout {
  hidden: DesktopPiece[];
  /** Sidebar order; TI stays last, below its rule. */
  rail: RailId[];
  /** Items that start a new group, with a gap above them. */
  railBreaks: RailId[];
  status: Record<Side, StatusId[]>;
  /** Each corner's pieces, the first nearest the corner. */
  corners: Record<Corner, OverlayId[]>;
  /** Pieces dragged to a place of their own; the rest stay in their corner. */
  free: Partial<Record<OverlayId, FreeSpot>>;
}

export interface PhoneLayout {
  hidden: PhonePiece[];
  bar: BarId[];
}

export interface PageLayout {
  v: 1;
  desktop: DesktopLayout;
  phone: PhoneLayout;
}

export const DEFAULT_DESKTOP: DesktopLayout = {
  hidden: [],
  rail: [...RAIL_IDS],
  // By how often people reach for them: what is on the map now, going somewhere in time or space, the specialist tools.
  railBreaks: ['history', 'recon'],
  status: { left: ['position', 'place'], right: ['quake', 'live', 'tracked', 'clock', 'shortcuts'] },
  corners: { 'top-left': ['search'], 'top-right': ['showing'], 'bottom-left': ['switcher'], 'bottom-right': ['controls', 'scale'] },
  free: {},
};

export const DEFAULT_PHONE: PhoneLayout = { hidden: [], bar: [...BAR_IDS] };

export const DEFAULT_LAYOUT: PageLayout = { v: 1, desktop: DEFAULT_DESKTOP, phone: DEFAULT_PHONE };

const DESKTOP_PIECES: ReadonlySet<string> = new Set<DesktopPiece>([
  ...[...RAIL_IDS, 'ai' as const].map(id => `rail:${id}` as const),
  'statusbar',
  ...STATUS_IDS.map(id => `status:${id}` as const),
  ...OVERLAY_IDS.map(id => `overlay:${id}` as const),
  ...CONTROL_IDS.map(id => `control:${id}` as const),
]);

const PHONE_PIECES: ReadonlySet<string> = new Set<PhonePiece>([
  ...BAR_IDS.map(id => `bar:${id}` as const),
  ...PHONE_OVERLAY_IDS.map(id => `overlay:${id}` as const),
  'logo',
]);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Known ids only, each once, in the saved order. */
function known<T extends string>(raw: unknown, allowed: ReadonlySet<string>, taken = new Set<string>()): T[] {
  const out: T[] = [];
  for (const id of list(raw)) {
    if (typeof id !== 'string' || !allowed.has(id) || taken.has(id)) continue;
    taken.add(id);
    out.push(id as T);
  }
  return out;
}

/** Puts back any id the saved list lacks (one added since it was saved), after the item it follows by default. */
export function restore<T>(saved: T[], defaults: readonly T[]): T[] {
  const out = [...saved];
  defaults.forEach((id, i) => {
    if (out.includes(id)) return;
    const before = defaults.slice(0, i).reverse().find(d => out.includes(d));
    out.splice(before === undefined ? 0 : out.indexOf(before) + 1, 0, id);
  });
  return out;
}

/** Ids spread over several lists (sides, corners): each id once, and a missing one back in its default list. */
function spread<K extends string, T extends string>(raw: unknown, defaults: Record<K, readonly T[]>, allowed: readonly T[]): Record<K, T[]> {
  const src = isRecord(raw) ? raw : {};
  const keys = Object.keys(defaults) as K[];
  const taken = new Set<string>();
  const allowedSet = new Set<string>(allowed);
  const out = Object.fromEntries(keys.map(k => [k, known<T>(src[k], allowedSet, taken)])) as Record<K, T[]>;
  for (const k of keys) {
    const missing = defaults[k].filter(id => !taken.has(id));
    if (missing.length) out[k] = restore(out[k], defaults[k].filter(id => out[k].includes(id) || missing.includes(id)));
  }
  return out;
}

/** Far enough for any screen; a spot past the edge is pulled back in by the corner it hangs from. */
const offset = (v: number) => Math.round(Math.max(0, Math.min(4000, v)));

function freeSpots(raw: unknown): Partial<Record<OverlayId, FreeSpot>> {
  const src = isRecord(raw) ? raw : {};
  const out: Partial<Record<OverlayId, FreeSpot>> = {};
  for (const id of OVERLAY_IDS) {
    const s = src[id];
    if (!isRecord(s) || !CORNERS.includes(s.corner as Corner) || typeof s.x !== 'number' || typeof s.y !== 'number' || !Number.isFinite(s.x) || !Number.isFinite(s.y)) continue;
    out[id] = { corner: s.corner as Corner, x: offset(s.x), y: offset(s.y) };
  }
  return out;
}

/** Anything read back from storage, made whole: unknown ids dropped, new ones in their default place. */
export function normalize(raw: unknown): PageLayout {
  const src = isRecord(raw) ? raw : {};
  const d = isRecord(src.desktop) ? src.desktop : {};
  const p = isRecord(src.phone) ? src.phone : {};
  const railSet = new Set<string>(RAIL_IDS);
  return {
    v: 1,
    desktop: {
      hidden: known<DesktopPiece>(d.hidden, DESKTOP_PIECES),
      rail: restore(known<RailId>(d.rail, railSet), RAIL_IDS),
      railBreaks: Array.isArray(d.railBreaks) ? known<RailId>(d.railBreaks, railSet) : [...DEFAULT_DESKTOP.railBreaks],
      status: spread(d.status, DEFAULT_DESKTOP.status, STATUS_IDS),
      corners: spread(d.corners, DEFAULT_DESKTOP.corners, OVERLAY_IDS),
      free: freeSpots(d.free),
    },
    phone: {
      hidden: known<PhonePiece>(p.hidden, PHONE_PIECES),
      bar: restore(known<BarId>(p.bar, new Set(BAR_IDS)), BAR_IDS),
    },
  };
}

/** Style studio's old "Zoom buttons" switch, now part of the layout. */
export function fromStudio(studio: unknown): PageLayout {
  return isRecord(studio) && studio.mapControls === false
    ? { ...DEFAULT_LAYOUT, desktop: { ...DEFAULT_DESKTOP, hidden: ['control:zoom'] } }
    : DEFAULT_LAYOUT;
}

/* ── Changes ──────────────────────────────────────────────────────────────── */

export function isShown(layout: PageLayout, form: Form, piece: Piece): boolean {
  return !(layout[form].hidden as string[]).includes(piece);
}

export function setShown(layout: PageLayout, form: Form, piece: Piece, shown: boolean): PageLayout {
  const hidden = (layout[form].hidden as Piece[]).filter(h => h !== piece);
  if (!shown) hidden.push(piece);
  return { ...layout, [form]: { ...layout[form], hidden } };
}

/** The list with one item moved by `delta` places, held at the ends. */
export function moveBy<T>(items: readonly T[], item: T, delta: number): T[] {
  const from = items.indexOf(item);
  if (from < 0) return [...items];
  const to = Math.max(0, Math.min(items.length - 1, from + delta));
  const out = [...items];
  out.splice(to, 0, ...out.splice(from, 1));
  return out;
}

export function setRail(layout: PageLayout, rail: RailId[]): PageLayout {
  return { ...layout, desktop: { ...layout.desktop, rail } };
}

export function setRailBreak(layout: PageLayout, id: RailId, on: boolean): PageLayout {
  const railBreaks = layout.desktop.railBreaks.filter(b => b !== id);
  if (on) railBreaks.push(id);
  return { ...layout, desktop: { ...layout.desktop, railBreaks } };
}

export const sideOf = (layout: PageLayout, id: StatusId): Side => (layout.desktop.status.left.includes(id) ? 'left' : 'right');

export function setStatusList(layout: PageLayout, side: Side, ids: StatusId[]): PageLayout {
  return { ...layout, desktop: { ...layout.desktop, status: { ...layout.desktop.status, [side]: ids } } };
}

/** Onto the other side, at its inner end: the left side's last place, the right side's first. */
export function setStatusSide(layout: PageLayout, id: StatusId, side: Side): PageLayout {
  if (sideOf(layout, id) === side) return layout;
  const { left, right } = layout.desktop.status;
  const status = side === 'left'
    ? { left: [...left, id], right: right.filter(s => s !== id) }
    : { left: left.filter(s => s !== id), right: [id, ...right] };
  return { ...layout, desktop: { ...layout.desktop, status } };
}

export function cornerOf(layout: PageLayout, id: OverlayId): Corner {
  return CORNERS.find(c => layout.desktop.corners[c].includes(id)) ?? 'top-left';
}

export function setCornerList(layout: PageLayout, corner: Corner, ids: OverlayId[]): PageLayout {
  return { ...layout, desktop: { ...layout.desktop, corners: { ...layout.desktop.corners, [corner]: ids } } };
}

/** Into a corner, furthest from its edge, so what already sits there keeps its place; a piece placed by hand goes back into one. */
export function moveToCorner(layout: PageLayout, id: OverlayId, corner: Corner): PageLayout {
  const { [id]: placed, ...free } = layout.desktop.free;
  if (cornerOf(layout, id) === corner) return placed ? { ...layout, desktop: { ...layout.desktop, free } } : layout;
  const corners = Object.fromEntries(CORNERS.map(c => [c, layout.desktop.corners[c].filter(o => o !== id)])) as Record<Corner, OverlayId[]>;
  corners[corner] = [...corners[corner], id];
  return { ...layout, desktop: { ...layout.desktop, corners, free } };
}

export function placeFreely(layout: PageLayout, id: OverlayId, spot: FreeSpot): PageLayout {
  return { ...layout, desktop: { ...layout.desktop, free: { ...layout.desktop.free, [id]: spot } } };
}

/** Every piece placed by hand back into its corner. */
export function backToCorners(layout: PageLayout): PageLayout {
  return { ...layout, desktop: { ...layout.desktop, free: {} } };
}

/** The corner a piece hangs from, by hand or in its stack: its menus open away from it. */
export const anchorOf = (layout: PageLayout, id: OverlayId): Corner => layout.desktop.free[id]?.corner ?? cornerOf(layout, id);

export function setBar(layout: PageLayout, bar: BarId[]): PageLayout {
  return { ...layout, phone: { ...layout.phone, bar } };
}

export function resetForm(layout: PageLayout, form: Form): PageLayout {
  return { ...layout, [form]: DEFAULT_LAYOUT[form] };
}

export const isDefault = (layout: PageLayout, form: Form) => JSON.stringify(layout[form]) === JSON.stringify(DEFAULT_LAYOUT[form]);
