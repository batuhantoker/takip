/** chronicle and past_event: TAKIP's historical record, read for a story about a place or a period. */
import { Prec } from '@takip/core/time';
import { HISTORY_FAMILIES, KINDS, articleTitle, facts, formatAt, linkedIds, when, type HistoryDetail, type HistoryFeature } from '@/lib/history/popup';
import { articleUrl } from '@/lib/core/wikipedia/refs';
import type { Place } from '../query/geo';
import type { Card, Lookup, Outcome } from '../tools';
import { clip, fail, fmt, getJson, given, numIn, ok, placeOf, refusedWhy, round, str, strings } from './shared';

const EVENTS = '/api/replay/history/events';

/** protocol.ts clips a result's data at 3,500 characters of JSON; the rows stop short of it. */
const DATA_BUDGET = 3300;

/** A year as the History clock counts them: "1914", "-500", "500 BC" (1 BC is year 0). */
function yearOf(s: string): number | null {
  const bc = /^(\d{1,5})\s*(bc|bce)$/i.exec(s);
  if (bc) return 1 - Number(bc[1]);
  return /^-?\d{1,5}$/.test(s) ? Number(s) : null;
}

/** Epoch seconds at the start of a year, BCE included (Date.UTC reads 0–99 as 1900–1999). */
function yearStart(y: number): number {
  const d = new Date(0);
  d.setUTCFullYear(y, 0, 1);
  return d.getTime() / 1000;
}

/** A year, a decade ("1990s"), a month ("May 1945") or a date, as [start, end) in epoch seconds. */
export function spanOf(v: unknown): [number, number] | null {
  const s = str(v, 40).replace(/^the\s+/i, '');
  const decade = /^(\d{3})0s$/.exec(s);
  if (decade) {
    const y = Number(decade[1]) * 10;
    return [yearStart(y), yearStart(y + 10)];
  }
  const y = yearOf(s);
  if (y !== null) return [yearStart(y), yearStart(y + 1)];
  const month = /^([a-z]{3,9})\.?\s+(\d{3,4})$/i.exec(s);
  if (month) {
    const t = Date.parse(`1 ${month[1]} ${month[2]} 00:00 UTC`);
    if (Number.isFinite(t)) {
      const end = new Date(t);
      end.setUTCMonth(end.getUTCMonth() + 1);
      return [t / 1000, end.getTime() / 1000];
    }
  }
  const t = Date.parse(s);
  return s && Number.isFinite(t) ? [Math.floor(t / 1000), Math.floor(t / 1000) + 86_400] : null;
}

/** from and to as a window in epoch seconds; to is inclusive and defaults to the end of from. */
export function windowOf(fromArg: unknown, toArg: unknown): { from: number; to: number } | string {
  const a = spanOf(fromArg);
  if (!a) return `"${str(fromArg)}" is not a year, a decade or a date`;
  const b = given(toArg) ? spanOf(toArg) : a;
  if (!b) return `"${str(toArg)}" is not a year, a decade or a date`;
  return b[1] > a[0] ? { from: Math.round(a[0]), to: Math.round(b[1]) } : 'to comes before from';
}

/** How far round a place a story reaches, by the kind of place the geocoder found. */
function reachKm(kind = ''): number {
  const k = kind.toLowerCase();
  if (/country|continent/.test(k)) return 900;
  if (/state|region|province|sea|ocean|gulf|peninsula/.test(k)) return 500;
  if (/city|town|capital|village|municipality|suburb/.test(k)) return 120;
  return 400;
}

/** [west, south, east, north] round a point; the route wraps longitudes past ±180 itself. */
function boxAround(p: { lat: number; lng: number }, km: number): [number, number, number, number] {
  const dLat = km / 111;
  const dLng = Math.min(180, km / (111 * Math.max(0.05, Math.cos((p.lat * Math.PI) / 180))));
  return [p.lng - dLng, Math.max(-90, p.lat - dLat), p.lng + dLng, Math.min(90, p.lat + dLat)];
}

/** One event as the route lists it, with where it is. */
export interface Found extends HistoryFeature { title: string; lat: number; lng: number }

interface EventsReply {
  counts?: Record<string, number>;
  features?: { geometry?: { coordinates?: [number, number] }; properties?: Partial<HistoryFeature> & { cell?: number; n?: number } }[];
}

export const kindLabel = (kind: string) => KINDS[kind] ?? (kind.split('.').pop() || kind).replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());

/** Events one by one, and the families the route sent as counted cells because they were too dense. */
function readEvents(body: EventsReply): { events: Found[]; dense: string[]; counts: Record<string, number> } {
  const events: Found[] = [];
  const dense = new Set<string>();
  for (const f of body.features ?? []) {
    const p = f.properties, c = f.geometry?.coordinates;
    if (!p || !c || typeof p.family !== 'string') continue;
    if (p.cell) { dense.add(p.family); continue; }
    if (typeof p.id !== 'number' || typeof p.t0 !== 'number' || typeof p.t1 !== 'number') continue;
    const kind = String(p.kind ?? '');
    events.push({
      id: p.id, kind, family: p.family, title: str(p.title, 200) || kindLabel(kind), t0: p.t0, t1: p.t1,
      prec: Number(p.prec ?? Prec.year), ongoing: Number(p.ongoing ?? 0), geoPrec: Number(p.geoPrec ?? 0),
      magnitude: typeof p.magnitude === 'number' ? p.magnitude : null, lat: c[1], lng: c[0],
    });
  }
  return { events, dense: [...dense], counts: body.counts ?? {} };
}

/** How much a family weighs in a story: a place's wars and politics carry it, nature and heritage colour it. */
const FAMILY_WEIGHT: Record<string, number> = { conflict: 6, politics: 3, territorial: 2, terror: 2, nuclear: 2 };

/** Battles and armed-conflict pairs are mostly parts of a war already told, so they count a quarter of their toll. */
const weightOf = (e: { kind: string; magnitude?: number | null }) =>
  (typeof e.magnitude !== 'number' ? -1 : e.magnitude * (/^(battle|conflict\.armed)/.test(e.kind) ? 0.25 : 1));

/**
 * The events that carry a story, most significant first. Within a family the biggest come first, then the
 * longest (t0..t1 is widened to the date's precision, so length only breaks ties); across families each
 * one's k-th event scores weight / (k + 1), so the wars lead without crowding out the rest. Unsized events
 * that only carry on from before the window (a claim made in 1828) are its backdrop: they come after what
 * happened in it, the latest first.
 */
export function pickSignificant<T extends Pick<Found, 'family' | 'kind' | 'magnitude' | 't0' | 't1'>>(events: T[], limit: number, from = -Infinity): T[] {
  const backdrop = (e: T) => (typeof e.magnitude !== 'number' && e.t0 < from ? 1 : 0);
  const byFamily = new Map<string, T[]>();
  for (const e of events) {
    const q = byFamily.get(e.family);
    if (q) q.push(e);
    else byFamily.set(e.family, [e]);
  }
  const scored: { e: T; score: number; w: number }[] = [];
  for (const [family, q] of byFamily) {
    const w = FAMILY_WEIGHT[family] ?? 1;
    q.sort((a, b) => backdrop(a) - backdrop(b) || weightOf(b) - weightOf(a)
      || (backdrop(a) ? b.t0 - a.t0 : (b.t1 - b.t0) - (a.t1 - a.t0)) || a.t0 - b.t0);
    q.slice(0, limit).forEach((e, k) => scored.push({ e, score: w / (k + 1), w }));
  }
  return scored.sort((a, b) => b.score - a.score || b.w - a.w || weightOf(b.e) - weightOf(a.e)).slice(0, limit).map(x => x.e);
}

/** "1991 – 1995", "Jul 1916", "since 2011": an event's dates at the precision they are known. */
export function spanWords(e: Pick<Found, 't0' | 't1' | 'prec' | 'ongoing'>): string {
  const start = formatAt(e.t0, e.prec);
  if (e.ongoing) return `since ${start}`;
  const end = formatAt(e.t1 - 1, e.prec);
  return end === start ? start : `${start} – ${end}`;
}

/** "Deaths: 20,000" in the family's own unit, or nothing when the source gives no size. */
function sizeOf(family: string, magnitude: number | null | undefined): string | undefined {
  const unit = HISTORY_FAMILIES[family]?.magnitude;
  return unit && typeof magnitude === 'number' && magnitude > 0 ? `${unit}: ${fmt(magnitude)}` : undefined;
}

const rowOf = (e: Found) => {
  const size = sizeOf(e.family, e.magnitude);
  return { id: e.id, when: spanWords(e), what: kindLabel(e.kind), title: clip(e.title, 70), ...(size ? { size } : {}) };
};

const windowWords = (from: number, to: number) => {
  const a = formatAt(from, Prec.year), b = formatAt(to - 1, Prec.year);
  return a === b ? a : `${a}–${b}`;
};

/** The camera for a story: the place's reach, or the events' spread when there is no place. */
function frameFor(points: { lat: number; lng: number }[], place: Place | null, reach: number) {
  if (place) return { lat: place.lat, lng: place.lng, zoom: Math.max(2, Math.min(9, Math.log2(40_000 / (reach * 2.4)))) };
  if (!points.length) return undefined;
  const lats = points.map(p => p.lat), lngs = points.map(p => p.lng);
  const spread = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs), 1);
  return { lat: (Math.max(...lats) + Math.min(...lats)) / 2, lng: (Math.max(...lngs) + Math.min(...lngs)) / 2, zoom: Math.max(1.5, Math.min(8, Math.log2(360 / spread))) };
}

/** Why the record could not be read, in words for the model to pass on. */
function unavailable(err: unknown): string {
  if (/HTTP 503/.test(err instanceof Error ? err.message : '')) return 'TAKIP\'s historical record is not loaded on this server yet';
  return refusedWhy(err, 'The historical record');
}

export async function chronicle(a: Record<string, unknown>, lk: Lookup, signal?: AbortSignal): Promise<Outcome> {
  const win = windowOf(a.from ?? a.year ?? a.at, a.to);
  if (typeof win === 'string') return fail('chronicle', `${win}: give from as a year ("1914", "500 BC"), a decade ("1990s") or a date`);
  const asked = strings(a.families);
  const families = asked.filter(f => f in HISTORY_FAMILIES);
  if (asked.length && !families.length) return fail('chronicle', `No such family: use ${Object.keys(HISTORY_FAMILIES).join(', ')}`);
  let place: Place | null = null;
  if (given(a.place ?? a.near)) {
    place = await placeOf(lk, a.place ?? a.near);
    if (!place) return fail('chronicle', `Could not find "${str(a.place ?? a.near)}" on the map`);
  }
  const reach = numIn(a.radius_km, 10, 5000) ?? reachKm(place?.kind);
  const [w, s, e, n] = place ? boxAround(place, reach) : [-180, -90, 180, 90];
  const z = Math.max(0, Math.min(10, Math.round(Math.log2(360 / Math.max(0.01, e - w)))));
  // An empty families= asks for none, so leave it out to ask for all.
  const query = `bbox=${round(w)},${round(s)},${round(e)},${round(n)}&from=${win.from}&to=${win.to}&z=${z}${families.length ? `&families=${families.join(',')}` : ''}`;
  let body: EventsReply | null;
  try {
    body = await getJson<EventsReply>(lk, `${EVENTS}?${query}`, signal);
  } catch (err) {
    return fail('chronicle', unavailable(err));
  }
  if (!body) return fail('chronicle', unavailable(new Error('HTTP 404')));

  const { events, dense, counts } = readEvents(body);
  const total = Object.values(counts).reduce((x, y) => x + y, 0);
  const period = windowWords(win.from, win.to);
  const where = place ? `within ${Math.round(reach)} km of ${place.name}` : 'worldwide';
  const header = {
    place: place?.name ?? 'the whole world', ...(place ? { radius_km: Math.round(reach) } : {}), period, total, by_family: counts,
    ...(dense.length ? { too_dense_to_list: dense } : {}),
  };
  // Trim the least significant until the rows fit, and only then put them in time order.
  const kept = pickSignificant(events, Math.round(numIn(a.limit, 1, 25) ?? 20), win.from);
  while (kept.length > 1 && JSON.stringify({ ...header, events: kept.map(rowOf) }).length > DATA_BUDGET) kept.pop();
  const story = kept.sort((x, y) => x.t0 - y.t0 || (y.magnitude ?? -1) - (x.magnitude ?? -1));

  const mix = Object.entries(counts).sort((x, y) => y[1] - x[1]).map(([f, k]) => `${(HISTORY_FAMILIES[f]?.label ?? f).toLowerCase()} ${fmt(k)}`).join(', ');
  const denseWords = dense.length ? `${dense.join(', ')} too dense to list one by one: narrow the place or the period` : '';
  const summary = !total
    ? `No events in TAKIP's historical record ${where}, ${period}: the record may not cover it`
    : [`${fmt(total)} events ${where}, ${period} (${mix})`, story.length ? `the ${story.length} most significant listed oldest first` : '', denseWords].filter(Boolean).join('; ');
  const card: Card = {
    kind: 'history', title: place?.name ?? 'The whole world', subtitle: `${period} · ${fmt(total)} event${total === 1 ? '' : 's'}`,
    items: story.map(ev => ({ label: ev.title, detail: [spanWords(ev), kindLabel(ev.kind), sizeOf(ev.family, ev.magnitude)].filter(Boolean).join(' · '), lat: round(ev.lat), lng: round(ev.lng) })),
  };
  const frame = frameFor(story, place, reach);
  const effects: Outcome['effects'] = a.show === false ? undefined : {
    highlight: { points: story.map(ev => ({ lat: ev.lat, lng: ev.lng, label: ev.title })), area: place ? { lat: place.lat, lng: place.lng, radiusKm: reach, label: place.name } : null },
    ...(frame ? { fly: frame } : {}),
  };
  return ok('chronicle', summary, { ...header, events: story.map(rowOf) }, card, effects);
}

/** How exactly the source placed an event (GeoPrec), and how close to come for it. */
const PLACED: Record<number, string> = { 1: 'the exact site', 2: 'the city', 3: 'the area, not an exact site', 4: 'an approximate place', 5: 'the country: the source names no closer place' };
const ZOOM_BY_PLACING: Record<number, number> = { 1: 8, 2: 7, 3: 6, 4: 5.5, 5: 4 };

interface Linked { id: number; title: string; when: string; lat?: number; lng?: number }

export async function pastEvent(a: Record<string, unknown>, lk: Lookup, signal?: AbortSignal): Promise<Outcome> {
  const id = typeof a.id === 'number' ? a.id : Number(str(a.id, 20));
  if (!Number.isInteger(id) || id <= 0) return fail('past_event', 'Give the id of an event from chronicle');
  const detail = (x: number) => getJson<HistoryDetail>(lk, `${EVENTS}/${x}`, signal);
  let d: HistoryDetail | null;
  try {
    d = await detail(id);
  } catch (err) {
    return fail('past_event', unavailable(err));
  }
  if (!d) return fail('past_event', `No event ${id} in TAKIP's historical record`);

  // The war it belongs to and what it includes are what carry a story, so fetch their titles too.
  const links = linkedIds(d);
  const want = [...new Set([...links.partOf.slice(0, 2), ...links.parts.slice(0, 6), ...links.related.slice(0, 3)])];
  const got = new Map((await Promise.all(want.map(x => detail(x).catch(() => null)))).filter((x): x is HistoryDetail => !!x).map(x => [x.id, x]));
  const linked = (ids: number[], n: number) => ids.slice(0, n).map(x => got.get(x)).filter((x): x is HistoryDetail => !!x)
    .map((x): Linked => ({ id: x.id, title: clip(str(x.title, 200) || kindLabel(x.kind), 70), when: when(x, x), ...(typeof x.lat === 'number' && typeof x.lon === 'number' ? { lat: round(x.lat), lng: round(x.lon) } : {}) }));
  const partOf = linked(links.partOf, 2), parts = linked(links.parts, 6), related = linked(links.related, 3);
  const brief = (x: Linked) => ({ id: x.id, title: x.title, when: x.when });
  const at = (x: Linked) => (x.lat !== undefined && x.lng !== undefined ? { lat: x.lat, lng: x.lng } : {});

  const title = str(d.title, 200) || kindLabel(d.kind);
  const dates = when(d, d);
  const size = sizeOf(d.family, d.magnitude);
  const known = facts(d.attrs ?? {});
  const placed = typeof d.attrs?.placed_at === 'string' ? `the ${d.attrs.placed_at}` : PLACED[d.geoPrec];
  const stored = articleTitle(d.attrs);
  const wikipedia = stored ? articleUrl(stored) : null;
  const source = d.source ? [d.source.name, d.source.attribution].filter(Boolean).join(' · ') : null;
  const where = typeof d.lat === 'number' && typeof d.lon === 'number' ? { lat: d.lat, lng: d.lon } : null;

  const data = {
    id: d.id, title, what: kindLabel(d.kind), family: HISTORY_FAMILIES[d.family]?.label ?? d.family, when: dates,
    ...(d.ongoing ? { ongoing: true } : {}),
    ...(size ? { size } : {}),
    ...(known.length ? { facts: Object.fromEntries(known) } : {}),
    ...(where ? { lat: round(where.lat), lng: round(where.lng), ...(placed ? { placed_at: placed } : {}) } : {}),
    ...(partOf.length ? { part_of: partOf.map(brief) } : {}),
    ...(parts.length ? { includes: parts.map(brief), ...(links.parts.length > parts.length ? { includes_more: links.parts.length - parts.length } : {}) } : {}),
    ...(related.length ? { related: related.map(brief) } : {}),
    ...(source ? { source } : {}),
    ...(wikipedia ? { wikipedia } : {}),
  };
  const summary = [
    `${title} (${kindLabel(d.kind).toLowerCase()}, ${dates})`, size,
    partOf[0] ? `part of ${partOf[0].title}` : '',
    links.parts.length ? `includes ${links.parts.length} event${links.parts.length === 1 ? '' : 's'}` : '',
    d.source ? `source: ${d.source.name}` : '',
  ].filter(Boolean).join('; ');
  const card: Card = {
    kind: 'history', title: clip(title, 80), subtitle: `${dates} · ${kindLabel(d.kind)}`,
    items: [
      ...(size ? [{ label: size }] : []),
      ...partOf.map(x => ({ label: `Part of ${x.title}`, detail: x.when, ...at(x) })),
      ...known.map(([label, text]) => ({ label: text, detail: label })),
      ...(wikipedia ? [{ label: 'Wikipedia', detail: clip(stored ?? '', 60), url: wikipedia }] : []),
      ...parts.map(x => ({ label: x.title, detail: x.when, ...at(x) })),
      ...(source ? [{ label: source, detail: 'Source' }] : []),
    ],
  };
  const effects: Outcome['effects'] = a.show === false || !where ? undefined : {
    highlight: { points: [{ lat: where.lat, lng: where.lng, label: title }], area: null },
    fly: { lat: where.lat, lng: where.lng, zoom: ZOOM_BY_PLACING[d.geoPrec] ?? 6 },
  };
  return ok('past_event', summary, data, card, effects);
}
