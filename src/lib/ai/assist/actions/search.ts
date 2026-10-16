/** find, scan, and picking out one entity to track: TI's reading of the live data. */
import { loadAdmin1, loadCountries } from '@/lib/places/areas/boundary-store';
import { FIND_LAYERS, SOURCES, entitiesOf, loaded, type Entity, type FindLayer } from '../catalog';
import { frame, km, zoomForRadius, type Bounds } from '../query/geo';
import { resolveRegion } from '../query/region';
import { runQuery, scan, type Scope } from '../query/run';
import { readFilters, readSort, type Filter } from '../query/spec';
import { feedWords } from '../feed-state';
import type { Lookup, Outcome } from '../tools';
import { clip, dataOf, ensure, fail, feedOf, feedTail, findLayer, given, isSite, numIn, ok, placeOf, row, str } from './shared';

const label = (l: FindLayer) => l.replace(/_/g, ' ');
const refused = (code: string, error: string, allowed?: string[]): Outcome => fail('find', `${code}: ${error}`, { code, ...(allowed ? { allowed: allowed.slice(0, 60) } : {}) });

/** Layers as asked: `layers` or `layer`, by name or a likely alias. */
function layersOf(a: Record<string, unknown>): { layers: FindLayer[]; unknown: string[] } {
  const asked = (Array.isArray(a.layers) && a.layers.length ? a.layers : [a.layer]).map(v => str(v, 40)).filter(Boolean);
  const layers: FindLayer[] = [], unknown: string[] = [];
  for (const n of asked) {
    const l = findLayer(n);
    if (l) { if (!layers.includes(l)) layers.push(l); } else unknown.push(n);
  }
  return { layers, unknown };
}

const regionLoaders = (lk: Lookup) => ({ countries: lk.regions?.countries ?? loadCountries, admin1: lk.regions?.admin1 ?? loadAdmin1, geocode: (q: string) => lk.geocode(q) });

export async function find(a: Record<string, unknown>, lk: Lookup, signal?: AbortSignal): Promise<Outcome> {
  const { layers, unknown } = layersOf(a);
  if (unknown.length || !layers.length) return refused('UNKNOWN_LAYER', unknown.length ? `No layer "${unknown.join('", "')}".` : 'Name a layer.', FIND_LAYERS);

  const filters: Filter[] = [];
  const read = readFilters(layers, a.where);
  if ('refusal' in read) return refused(read.refusal.code, read.refusal.error, read.refusal.allowed);
  filters.push(...read.filters);
  const min = numIn(a.min, -1e9, 1e9);
  if (min !== null) filters.push({ field: 'value', op: 'gte', value: min, type: 'number' });
  const sort = readSort(layers, a.sort);
  if ('refusal' in sort) return refused(sort.refusal.code, sort.refusal.error, sort.refusal.allowed);

  let among: Set<string> | undefined;
  if (a.follow_up === true) {
    const last = lk.memo?.lastFind;
    if (!last?.keys.length) return refused('NO_EARLIER_RESULT', 'There is no earlier find to narrow; search afresh.');
    among = new Set(last.keys);
  }

  for (const l of layers) {
    if (await ensure(lk, l, signal)) continue;
    const f = feedOf(lk, [l]);
    return f.state === 'unavailable'
      ? refused('UNAVAILABLE', `The ${label(l)} feed is down${f.note ? ` (${f.note})` : ''}, so there is nothing to count. Say so.`)
      : refused('NOT_READY', `The ${label(l)} feed has not loaded yet; try again in a moment.`);
  }

  let scope: Scope = { kind: 'anywhere' };
  let where = '';
  const radiusKm = numIn(a.radius_km, 1, 20_000) ?? 500;
  if (given(a.near)) {
    const near = await placeOf(lk, a.near);
    if (!near) return refused('NO_PLACE', `Could not find "${str(a.near)}" on the map.`);
    scope = { kind: 'near', centre: near, radiusKm, name: near.name };
    where = ` within ${Math.round(radiusKm)} km of ${near.name}`;
  } else if (given(a.region)) {
    const region = await resolveRegion(str(a.region, 120), regionLoaders(lk)).catch(() => null);
    if (!region) return refused('NO_REGION', `"${str(a.region)}" is not a country or state on file; for a city use near with radius_km.`);
    scope = { kind: 'region', name: region.name, geometry: region.geometry, centre: region.centre };
    where = ` in ${region.name}`;
  } else if (a.in_view === true && isSite(lk) && lk.view().bounds) {
    const v = lk.view();
    scope = { kind: 'view', bounds: v.bounds!, centre: { lat: v.lat, lng: v.lng } };
    where = ' in view';
  }

  const res = runQuery(dataOf(lk), {
    layers, filters, scope, among,
    text: str(a.text, 120) || undefined,
    withinHours: numIn(a.within_hours, 0.1, 24 * 60) ?? undefined,
    sortBy: sort.sortBy,
    sortDir: a.order === 'asc' || a.order === 'desc' ? a.order : undefined,
    limit: numIn(a.limit, 1, 25) ?? undefined,
  });
  if (lk.memo) lk.memo.lastFind = { layers, keys: res.keys };

  const feed = feedOf(lk, layers);
  const names = layers.map(label).join(' and ');
  const floor = res.complete ? '' : 'at least ';
  const summary = `${floor}${res.matched.toLocaleString('en-US')} of ${res.total.toLocaleString('en-US')} ${names}${where} matched${res.matched > res.items.length ? `, showing the top ${res.items.length}` : ''}${feedTail(feed)}`;
  const value = layers.length === 1 ? SOURCES[layers[0]].value : undefined;
  const placed = res.items.filter(e => e.lat !== null && e.lng !== null) as (Entity & { lat: number; lng: number; km?: number })[];
  const view = scope.kind === 'near'
    ? { lat: scope.centre.lat, lng: scope.centre.lng, zoom: zoomForRadius(radiusKm) }
    : frame(placed);

  return ok('find', summary, {
    layers, ...(value ? { value } : {}), sorted_by: res.sortBy,
    complete: res.complete, ...(res.caveats.length ? { caveat: res.caveats.join('; ') } : {}),
    ...(feedWords(feed) ? { feed: feedWords(feed) } : {}),
    items: res.items.map(e => ({ ...(layers.length > 1 ? { layer: e.layer } : {}), ...row(e) })),
  }, {
    kind: 'find',
    title: `${floor}${res.matched.toLocaleString('en-US')} ${names}${where}`,
    subtitle: [value && res.items.length ? `by ${res.sortBy === 'largest' ? value : res.sortBy}` : '', feedWords(feed)].filter(Boolean).join(' · ') || undefined,
    items: res.items.map(e => ({
      label: e.title, detail: [e.detail, e.km !== undefined ? `${e.km} km` : ''].filter(Boolean).join(' · ') || undefined,
      ...(e.lat !== null && e.lng !== null ? { lat: e.lat, lng: e.lng } : {}), url: e.url,
    })),
  }, a.show === false || !placed.length ? undefined : {
    highlight: {
      points: placed.map(e => ({ lat: e.lat, lng: e.lng, label: clip(e.title, 34) })),
      area: scope.kind === 'near' ? { lat: scope.centre.lat, lng: scope.centre.lng, radiusKm, label: scope.name } : null,
      ...(scope.kind === 'region' ? { outlines: [{ geometry: scope.geometry, label: scope.name }] } : {}),
    },
    ...(view ? { fly: view } : {}),
  });
}

/** A box round a point, for scanning an area rather than the view. */
function boxAround(lat: number, lng: number, r: number): Bounds {
  const dLat = r / 111, dLng = r / (111 * Math.max(0.05, Math.cos((lat * Math.PI) / 180)));
  return { south: Math.max(-90, lat - dLat), north: Math.min(90, lat + dLat), west: lng - dLng, east: lng + dLng };
}

/** What a server scan fetches when asked for no layers: the busy, cheap feeds. */
const SERVER_SCAN: FindLayer[] = ['flights', 'military_flights', 'ships', 'earthquakes', 'fires', 'weather', 'incidents', 'air_raid_alerts', 'news'];

export async function scanArea(a: Record<string, unknown>, lk: Lookup, signal?: AbortSignal): Promise<Outcome> {
  const wanted = (Array.isArray(a.layers) ? a.layers : []).map(findLayer).filter((l): l is FindLayer => l !== null);
  let bounds: Bounds | undefined;
  let centre: { lat: number; lng: number; r: number } | null = null;
  let where = 'In view now';
  if (given(a.near)) {
    const p = await placeOf(lk, a.near);
    if (!p) return fail('scan', `Could not find "${str(a.near)}" on the map`);
    const r = numIn(a.radius_km, 1, 3000) ?? 250;
    bounds = boxAround(p.lat, p.lng, r);
    centre = { ...p, r };
    where = `Within ${Math.round(r)} km of ${p.name}`;
  } else if (isSite(lk)) {
    bounds = lk.view().bounds;
    if (!bounds) return fail('scan', 'The map has not said what is in view yet');
  } else {
    return fail('scan', 'Give near: a place or {lat, lng}');
  }
  if (!isSite(lk)) await Promise.all((wanted.length ? wanted : SERVER_SCAN).map(l => ensure(lk, l, signal)));
  let rows = scan(dataOf(lk), bounds, wanted.length ? wanted : undefined);
  if (centre) {
    const c = centre;
    rows = rows.map(r0 => {
      const inside = entitiesOf(dataOf(lk), r0.layer).filter(e => e.lat !== null && e.lng !== null && km(c, { lat: e.lat, lng: e.lng }) <= c.r);
      return { ...r0, count: inside.length, top: r0.top.filter(t => inside.some(e => e.id === t.id)) };
    }).filter(r0 => r0.count > 0);
  }
  const quiet = (wanted.length ? wanted : FIND_LAYERS).filter(l => loaded(dataOf(lk), l) || feedOf(lk, [l]).state === 'unavailable')
    .map(l => ({ l, f: feedOf(lk, [l]) })).filter(x => x.f.state !== 'live');
  const notes = Object.fromEntries(quiet.map(x => [x.l, feedWords(x.f)]));
  if (!rows.length) return ok('scan', `Nothing live from the loaded layers ${where.toLowerCase()}`, { rows: [], ...(quiet.length ? { feeds: notes } : {}) });
  return ok('scan', rows.map(r => `${SOURCES[r.layer].partial ? 'at least ' : ''}${r.count.toLocaleString('en-US')} ${label(r.layer)}${notes[r.layer] ? ` (${notes[r.layer]})` : ''}`).join(', '),
    { rows: rows.map(r => ({ layer: r.layer, count: r.count, complete: !SOURCES[r.layer].partial, ...(notes[r.layer] ? { feed: notes[r.layer] } : {}), top: r.top.map(row) })), ...(quiet.length ? { feeds: notes } : {}) },
    {
      kind: 'scan', title: where,
      items: rows.map(r => ({
        label: `${r.count.toLocaleString('en-US')} ${label(r.layer)}`,
        detail: [r.top.map(e => e.title).join(' · '), notes[r.layer]].filter(Boolean).join(' · '),
        ...(r.top[0]?.lat !== null && r.top[0]?.lng !== null ? { lat: r.top[0].lat!, lng: r.top[0].lng! } : {}),
      })),
    });
}

/* ───────────── One entity, for track ───────────── */

export type Picked = { kind: 'aircraft' | 'ship' | 'satellite'; entity: Entity };

const KIND: Partial<Record<FindLayer, Picked['kind']>> = { flights: 'aircraft', military_flights: 'aircraft', ships: 'ship', satellites: 'satellite' };
const TRACKABLE = Object.keys(KIND) as FindLayer[];

/** The aircraft, ship or satellite the model means: by id, by name, or the nearest airborne one to a place. */
export async function pickEntity(a: Record<string, unknown>, lk: Lookup, signal?: AbortSignal): Promise<Picked | string> {
  const asked = findLayer(a.layer);
  if (asked && !KIND[asked]) return `Only aircraft, ships and satellites can be tracked, not ${label(asked)}`;
  const id = str(a.id, 40).toLowerCase(), text = str(a.text, 80);
  const pool = asked ? [asked] : given(a.nearest_to) ? ['flights', 'military_flights'] as FindLayer[] : TRACKABLE.filter(l => loaded(dataOf(lk), l));
  if (asked && !(await ensure(lk, asked, signal))) return `The ${label(asked)} feed has not loaded yet`;
  const all = pool.flatMap(l => entitiesOf(dataOf(lk), l));
  const as = (e: Entity | undefined): Picked | null => (e ? { kind: KIND[e.layer]!, entity: e } : null);

  if (id) {
    const hit = all.find(e => e.id.toLowerCase() === id || e.id.replace(/^0+/, '') === id.replace(/^0+/, ''));
    return as(hit) ?? `Nothing with id "${str(a.id)}" is on the map now`;
  }
  if (text) {
    const t = text.toLowerCase().replace(/\s+/g, '');
    const exact = all.find(e => e.title.toLowerCase().replace(/\s+/g, '') === t || String(e.raw.registration ?? '').toLowerCase().replace(/-/g, '') === t.replace(/-/g, ''));
    const loose = exact ?? all.find(e => `${e.title} ${e.detail}`.toLowerCase().includes(text.toLowerCase()));
    return as(loose) ?? `Nothing called "${text}" is on the map now`;
  }
  if (given(a.nearest_to)) {
    const p = await placeOf(lk, a.nearest_to);
    if (!p) return `Could not find "${str(a.nearest_to)}" on the map`;
    for (const l of pool) await ensure(lk, l, signal);
    const near = pool.flatMap(l => entitiesOf(dataOf(lk), l))
      .filter(e => e.lat !== null && e.lng !== null && e.raw.grounded !== true)
      .map(e => ({ e, d: km(p, { lat: e.lat!, lng: e.lng! }) }))
      .filter(x => x.d <= 500)
      .sort((x, y) => x.d - y.d)[0];
    return as(near?.e) ?? `Nothing ${pool.includes('ships') ? 'at sea' : 'in the air'} within 500 km of ${p.name}`;
  }
  return 'Give an id from RESULTS, a callsign or name as text, or nearest_to a place';
}
