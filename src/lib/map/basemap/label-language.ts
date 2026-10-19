/**
 * Base map names in the reader's language. The OpenMapTiles tiles carry `name:<lang>` for most places; where one is
 * missing, a name the style already used shows instead (English, then the local name).
 */
import type * as maplibregl from 'maplibre-gl';
import type { Locale } from '@/lib/core/i18n/locales';
import { BASEMAP_SOURCE } from './provider';

const FIELDS: Record<Exclude<Locale, 'en'>, string[]> = {
  tr: ['name:tr'], es: ['name:es'], pt: ['name:pt'], fr: ['name:fr'], de: ['name:de'], ru: ['name:ru'],
  ar: ['name:ar'], zh: ['name:zh-Hans', 'name:zh'], ja: ['name:ja'],
};

// Street names have no translations, and house numbers are numbers.
const KEEP = new Set(['transportation_name', 'housenumber']);

type Value = unknown;

const NAME_FIELDS = new Set(['name', 'name_en']);

/** `text-field` with each read of `name` or `name_en` preferring the reader's language. */
export function localizeTextField(field: Value, locale: Locale): Value {
  if (locale === 'en') return field;
  const own = FIELDS[locale].map(f => ['get', f]);
  const prefer = (name: string) => ['coalesce', ...own, ['get', name]];
  const token = (v: Value) => (typeof v === 'string' ? /^\{(name|name_en)\}$/.exec(v)?.[1] : undefined);
  if (typeof field === 'string') {
    const name = token(field);
    return name ? prefer(name) : field;
  }
  if (Array.isArray(field)) {
    const walk = (node: Value): Value => {
      if (!Array.isArray(node)) return node;
      if (node.length === 2 && node[0] === 'get' && NAME_FIELDS.has(node[1])) return prefer(node[1]);
      return node.map(walk);
    };
    return walk(field);
  }
  const stops = (field as { stops?: [number, Value][] } | null)?.stops;
  if (Array.isArray(stops) && stops.length && stops.every(([, v]) => token(v))) {
    // A legacy zoom function's first value also holds below its first stop, as a step's base does.
    return ['step', ['zoom'], prefer(token(stops[0][1])!), ...stops.slice(1).flatMap(([z, v]) => [z, prefer(token(v)!)])];
  }
  return field;
}

const done = new WeakMap<maplibregl.Map, Set<string>>();

/** Rewrites the base map's label layers once each, including ones added later (the detail labels). */
export function localizeBaseLabels(map: maplibregl.Map, locale: Locale) {
  if (locale === 'en' || done.has(map)) return;
  const seen = new Set<string>();
  done.set(map, seen);
  const apply = () => rewrite(map, locale, seen);
  apply();
  map.on('styledata', apply);
}

function rewrite(map: maplibregl.Map, locale: Locale, seen: Set<string>) {
  for (const id of map.getLayersOrder()) {
    if (seen.has(id)) continue;
    seen.add(id);
    const layer = map.getLayer(id);
    if (layer?.type !== 'symbol' || layer.source !== BASEMAP_SOURCE || KEEP.has(layer.sourceLayer ?? '')) continue;
    const field = map.getLayoutProperty(id, 'text-field');
    if (field === undefined) continue;
    const next = localizeTextField(field, locale);
    if (next !== field) map.setLayoutProperty(id, 'text-field', next as maplibregl.ExpressionSpecification);
  }
}
