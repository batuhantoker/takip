/** brief: the situation at a place: hazards and alerts near it, traffic, headlines that name it, and the country's travel advice. */
import { SOURCES, entitiesOf, loaded, type FindLayer } from '../catalog';
import { feedWords } from '../feed-state';
import { km } from '../query/geo';
import { runQuery } from '../query/run';
import type { Lookup, Outcome } from '../tools';
import { clip, dataOf, ensure, fail, feedOf, getJson, isSite, numIn, ok, placeOf, round, row, str } from './shared';

const HAZARDS: FindLayer[] = ['earthquakes', 'fires', 'fire_incidents', 'weather', 'incidents', 'air_raid_alerts', 'radiation'];
const TRAFFIC: FindLayer[] = ['flights', 'military_flights', 'ships'];

interface Dossier {
  location?: { display_name?: string; country?: string };
  country?: { name?: string; capital?: string; population?: number } | null;
  head_of_state?: { name: string; position: string } | null;
  wikipedia?: { title?: string; extract?: string } | null;
  travel_advice?: { issuer: string; level: number; label: string }[];
  unavailable?: string[];
}

const NAMES: Partial<Record<FindLayer, string>> = {
  fires: 'fire detections', fire_incidents: 'agency wildfires', weather: 'weather warnings', incidents: 'disaster alerts',
  air_raid_alerts: 'air-raid alerts', radiation: 'radiation monitors', military_flights: 'military aircraft',
};
const named = (l: FindLayer) => NAMES[l] ?? l.replace(/_/g, ' ');

const fold = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export async function brief(a: Record<string, unknown>, lk: Lookup, signal?: AbortSignal): Promise<Outcome> {
  const place = await placeOf(lk, a.place ?? a.near);
  if (!place) return fail('brief', `Could not find "${str(a.place ?? a.near)}" on the map`);
  const radiusKm = numIn(a.radius_km, 10, 3000) ?? 300;
  // The page reads what it holds; the server fetches the lot.
  const layers = [...HAZARDS, ...TRAFFIC, 'news' as FindLayer];
  if (!isSite(lk)) await Promise.all(layers.map(l => ensure(lk, l, signal).catch(() => false)));
  const dossier = await getJson<Dossier>(lk, `/api/region-dossier?lat=${place.lat.toFixed(4)}&lng=${place.lng.toFixed(4)}`, signal).catch(() => null);

  const scope = { kind: 'near' as const, centre: place, radiusKm, name: place.name };
  const section = (l: FindLayer) => {
    const res = runQuery(dataOf(lk), { layers: [l], scope, limit: 3, sortBy: SOURCES[l].value ? 'largest' : 'newest' });
    const f = feedWords(feedOf(lk, [l]));
    return { layer: l, count: res.matched, complete: res.complete, ...(f ? { feed: f } : {}), top: res.items.map(row) };
  };
  const unread = layers.filter(l => !loaded(dataOf(lk), l));
  const hazards = HAZARDS.filter(l => loaded(dataOf(lk), l)).map(section).filter(s => s.count > 0);
  const traffic = TRAFFIC.filter(l => loaded(dataOf(lk), l)).map(section);

  const words = fold(place.name.split(',')[0]).split(/\s+/).filter(w => w.length > 2);
  const headlines = entitiesOf(dataOf(lk), 'news')
    .filter(e => (e.lat !== null && e.lng !== null && km(place, { lat: e.lat, lng: e.lng }) <= radiusKm) || (words.length && words.every(w => fold(e.title).includes(w))))
    .sort((x, y) => (y.time ?? 0) - (x.time ?? 0)).slice(0, 6).map(row);

  const advice = (dossier?.travel_advice ?? []).map(t => ({ issuer: t.issuer, level: t.level, advice: t.label }));
  const country = dossier?.location?.country || dossier?.country?.name || null;
  const data = {
    place: { name: place.name, lat: round(place.lat), lng: round(place.lng), radius_km: radiusKm, ...(dossier?.location?.display_name ? { located: dossier.location.display_name } : {}) },
    hazards, traffic, headlines,
    ...(country ? { country } : {}),
    ...(dossier?.head_of_state ? { head_of_state: `${dossier.head_of_state.name} (${dossier.head_of_state.position})` } : {}),
    ...(advice.length ? { travel_advice: advice } : {}),
    ...(dossier?.wikipedia?.extract ? { background: clip(dossier.wikipedia.extract, 400) } : {}),
    ...(unread.length ? { not_loaded: unread } : {}),
    ...(dossier?.unavailable?.length ? { unavailable: dossier.unavailable } : {}),
  };
  const worstAdvice = advice.sort((x, y) => y.level - x.level)[0];
  const summary = [
    `${place.name}${country && !place.name.includes(country) ? ` (${country})` : ''}`,
    hazards.length ? hazards.map(h => `${h.complete ? '' : 'at least '}${h.count} ${named(h.layer)}`).join(', ') : `no hazards from the loaded feeds within ${radiusKm} km`,
    traffic.length ? traffic.map(t => (t.count ? `${t.complete ? 'at least ' : ''}${t.count} ${named(t.layer)}` : `no ${named(t.layer)} seen`)).join(', ') : '',
    `${headlines.length} recent headline${headlines.length === 1 ? '' : 's'}`,
    worstAdvice ? `${worstAdvice.issuer}: ${worstAdvice.advice}` : '',
  ].filter(Boolean).join('; ');
  return ok('brief', summary, data, {
    kind: 'brief', title: place.name, subtitle: `within ${radiusKm} km`,
    items: [
      ...hazards.map(h => ({ label: `${h.count} ${named(h.layer)}`, detail: [h.top.map(t => t.name).join(' · '), h.feed].filter(Boolean).join(' · ') || undefined, ...(h.top[0]?.lat !== undefined ? { lat: h.top[0].lat, lng: h.top[0].lng } : {}) })),
      ...traffic.filter(t => t.count).map(t => ({ label: `${t.count} ${named(t.layer)}`, detail: t.feed })),
      ...headlines.slice(0, 3).map(h => ({ label: h.name, detail: h.when, ...(h.lat !== undefined ? { lat: h.lat, lng: h.lng } : {}) })),
      ...(worstAdvice ? [{ label: worstAdvice.advice, detail: worstAdvice.issuer }] : []),
    ],
  }, { highlight: { points: [], area: { lat: place.lat, lng: place.lng, radiusKm, label: place.name } }, fly: { lat: place.lat, lng: place.lng, zoom: Math.max(3, Math.min(9, Math.log2(40_000 / (radiusKm * 2.4)))) } });
}
