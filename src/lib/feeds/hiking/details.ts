import { fromMercator } from './mercator';

export interface RouteRef {
  id: number;
  name?: string;
  ref?: string;
  group?: string;
}

/** A route's details without its geometry. Lengths are metres. */
export interface RouteDetails {
  id: number;
  name?: string;
  local_name?: string;
  ref?: string;
  group?: string;
  itinerary?: string[];
  symbol_id?: string;
  symbol_description?: string;
  /** From the route's own distance tag. */
  official_length?: number;
  /** Measured along the mapped ways. */
  length?: number;
  operator?: string;
  note?: string;
  description?: string;
  url?: string;
  wikipedia?: string;
  /** West, south, east, north. */
  bbox?: [number, number, number, number];
  /** The routes this one is a stage of. */
  superroutes: RouteRef[];
  /** How many stages it has. */
  subroutes: number;
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

function wikipediaUrl(v: unknown): string | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const pages = v as Record<string, unknown>;
  const lang = 'en' in pages ? 'en' : Object.keys(pages).find(k => /^[a-z-]{2,12}$/.test(k));
  const title = lang ? str(pages[lang]) : undefined;
  return lang && title ? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}` : undefined;
}

function refs(v: unknown): RouteRef[] {
  if (!v || typeof v !== 'object') return [];
  return Object.values(v as Record<string, Record<string, unknown>>)
    .filter(r => Number.isInteger(r?.id))
    .map(r => ({ id: r.id as number, name: str(r.name), ref: str(r.ref), group: str(r.group) }));
}

/**
 * /details/relation/{id} cut down to what a popup shows. Upstream sends every
 * way of the route with its geometry, which runs to megabytes for a long trail.
 */
export function slimDetails(raw: unknown): RouteDetails | null {
  const d = raw as Record<string, unknown> | null;
  if (!d || !Number.isInteger(d.id)) return null;
  const b = Array.isArray(d.bbox) && d.bbox.length === 4 && d.bbox.every(n => Number.isFinite(n)) ? d.bbox as number[] : null;
  const route = d.route as Record<string, unknown> | undefined;
  return {
    id: d.id as number,
    name: str(d.name),
    local_name: str(d.local_name),
    ref: str(d.ref),
    group: str(d.group),
    itinerary: Array.isArray(d.itinerary) ? d.itinerary.filter((s): s is string => typeof s === 'string') : undefined,
    symbol_id: str(d.symbol_id),
    symbol_description: str(d.symbol_description),
    official_length: num(d.official_length),
    length: num(route?.length),
    operator: str(d.operator),
    note: str(d.note),
    description: str(d.description),
    url: str(d.url),
    wikipedia: wikipediaUrl(d.wikipedia),
    bbox: b ? [...fromMercator(b[0], b[1]), ...fromMercator(b[2], b[3])] : undefined,
    superroutes: refs(d.superroutes),
    subroutes: refs(d.subroutes).length,
  };
}
