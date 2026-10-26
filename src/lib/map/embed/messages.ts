/**
 * What a place page and the live map framed in it say to each other. The page marks the places its rows are about
 * and moves the map (components/site/pages/map-talk.ts); the frame says when it can listen and which place was
 * clicked on it (components/site/embed/hooks/use-page-talk.ts). Each end reads only its own origin's messages,
 * from the one window it talks to.
 */

/** A place a row is about. An empty label marks it without naming it. */
export interface MapMark { id: string; lon: number; lat: number; label: string }

/** Places to mark at once; with `route` they are a day's stops in order, and the map keeps them all in view. */
export interface MarkSet { points: MapMark[]; route?: true }

/** Page → frame: mark places (null clears them), or move the camera. */
export type ToFrame =
  | { type: 'mark'; mark: MarkSet | null }
  | { type: 'fly'; lon: number; lat: number; zoom?: number };

/** Frame → page: it is listening, or a place with this id was clicked. */
export type ToPage = { type: 'ready' } | { type: 'click'; id: string };

const CHANNEL = 'takip-map';
const MAX_POINTS = 60;
const MAX_ID = 80;
const MAX_LABEL = 120;

/** The message as posted. */
export const wire = (m: ToFrame | ToPage) => ({ channel: CHANNEL, ...m });

const isNum = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= MAX_ID;

function point(v: unknown): MapMark | null {
  if (!v || typeof v !== 'object') return null;
  const { id, lon, lat, label } = v as Record<string, unknown>;
  return isId(id) && isNum(lon, -180, 180) && isNum(lat, -90, 90) && typeof label === 'string' && label.length <= MAX_LABEL
    ? { id, lon, lat, label } : null;
}

function body(e: Pick<MessageEvent, 'origin' | 'source' | 'data'>, origin: string, from: MessageEventSource | null): Record<string, unknown> | null {
  if (!from || e.source !== from || e.origin !== origin) return null;
  const d = e.data as Record<string, unknown> | null;
  return d && typeof d === 'object' && d.channel === CHANNEL ? d : null;
}

/** In the frame: what the page asked, when `e` came from `parent` on our origin and is well formed. */
export function fromPage(e: Pick<MessageEvent, 'origin' | 'source' | 'data'>, origin: string, parent: MessageEventSource | null): ToFrame | null {
  const d = body(e, origin, parent);
  if (d?.type === 'fly') {
    const { lon, lat, zoom } = d;
    if (!isNum(lon, -180, 180) || !isNum(lat, -85, 85) || (zoom !== undefined && !isNum(zoom, 1.5, 18))) return null;
    return { type: 'fly', lon, lat, ...(zoom !== undefined ? { zoom } : {}) };
  }
  if (d?.type !== 'mark') return null;
  if (d.mark === null) return { type: 'mark', mark: null };
  const m = d.mark as Record<string, unknown> | undefined;
  if (!m || !Array.isArray(m.points) || !m.points.length || m.points.length > MAX_POINTS) return null;
  const points = m.points.map(point);
  if (points.some(p => !p)) return null;
  return { type: 'mark', mark: { points: points as MapMark[], ...(m.route === true ? { route: true } : {}) } };
}

/** On the page: what the frame said, when `e` came from `frame` on our origin and is well formed. */
export function fromFrame(e: Pick<MessageEvent, 'origin' | 'source' | 'data'>, origin: string, frame: MessageEventSource | null): ToPage | null {
  const d = body(e, origin, frame);
  if (d?.type === 'ready') return { type: 'ready' };
  return d?.type === 'click' && isId(d.id) ? { type: 'click', id: d.id } : null;
}
