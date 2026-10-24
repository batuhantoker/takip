/**
 * The events a History tour flies to and opens, so the detail is on screen (the user, relayed 2026-10-21: "show
 * details… valid for other videos"): the biggest by physical size where the family has one, else famous ones picked
 * by hand.
 */
import { arc } from './facts';
import { drawnEvents, eventsById, type HistoryEvent } from './history-db';
import { KEPT_OUT } from './kept-out';

/** Picked by hand where nothing ranks them: well known and not contested, as [history.db event id, name to say]. */
const PICKED: Record<string, [number, string][]> = {
  'battles-in-history': [[197600, 'Battle of Waterloo'], [197286, 'Battle of Austerlitz'], [211763, 'Battle of Trafalgar']],
  'treaties-in-history': [[214768, 'Peace of Westphalia'], [214482, 'Treaty of Paris']],
  'revolutions-in-history': [[231085, 'French Revolution'], [231091, 'October Revolution'], [231100, 'Xinhai Revolution']],
  'peace-agreements': [[337963, 'Good Friday Agreement'], [337798, 'Dayton Agreement'], [337738, 'Carter Agreement in Sudan']],
  'wars-in-history': [[1, 'World War I'], [13, 'World War II'], [19, 'Korean War']],
  'coups-in-history': [[215044, 'Carnation Revolution'], [215073, '1973 coup in Chile']],
  'epidemics-and-plague': [[358786, 'Black Death in Italy']],
  'fires-in-history': [[358541, 'Notre-Dame fire']],
  'rocket-launch-history': [[265521, 'Sputnik 1']],
  'missile-tests-map': [[265275, 'first R-7 test']],
  'ancient-shipwrecks': [[258457, 'Antikythera wreck'], [259050, 'La Madrague-de-Montredon wreck'], [259049, 'La Madrague de Giens wreck']],
  'world-heritage-in-danger': [[184613, 'Everglades National Park'], [184644, 'Chan Chan'], [184647, 'Potosí']],
  // by size this would be Valdivia, which hazards-1900 and big-quakes already lead with in the same weeks
  'earthquakes-in-history': [[189435, '1964 Alaska earthquake'], [192095, '2011 Tōhoku earthquake'], [189239, '1952 Kamchatka earthquake']],
};

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
/** A hazard's physical size, and how it is said. */
const SIZE: Record<string, { of: (e: HistoryEvent) => number | null; said: (v: number) => string }> = {
  'hazard.quake': { of: e => e.magnitude, said: v => `magnitude ${v}` },
  'hazard.volcano': { of: e => num(e.attrs.vei), said: v => `explosivity ${v} of 8` },
  'hazard.tsunami': { of: e => num(e.attrs.max_water_height_m), said: v => `water up to ${v} m` },
  'hazard.storm': { of: e => num(e.attrs.max_wind_kt), said: v => `winds up to ${v} knots` },
  'hazard.fireball': { of: e => num(e.attrs.impact_energy_kt), said: v => `about ${v} kilotons of energy` },
};
/** Picks at least this far apart (degrees), so a long tour's stops aren't one cluster. */
const APART = 20;

/** `wiki`: its article ("Title", or "fr:Titre" in another language's Wikipedia), for a striking fact to tell. */
export interface Spotlight { id: number; name: string; t: number; lat: number; lon: number; measure: string | null; wiki: string | null }

const told = (e: HistoryEvent, name: string): Spotlight => {
  const size = SIZE[e.kind], v = size?.of(e);
  return { id: e.id, name, t: e.t, lat: e.lat, lon: e.lon, measure: v != null && size ? size.said(v) : null, wiki: typeof e.attrs.wiki === 'string' ? e.attrs.wiki : null };
};

/** Up to `n` events for a page's tour, the first the one a short shows; empty where nothing ranks or is picked. */
export function spotlights(slug: string, kinds: string[], from: number, to: number, n: number): Spotlight[] {
  const picked = PICKED[slug];
  if (picked) {
    const rows = new Map(eventsById(picked.map(p => p[0])).map(e => [e.id, e]));
    return picked.flatMap(([id, name]) => (rows.has(id) ? [told(rows.get(id)!, name)] : [])).slice(0, n);
  }
  const measured = kinds.filter(k => SIZE[k] && !KEPT_OUT.has(k));
  if (!measured.length) return [];
  const ranked = drawnEvents(measured, from, to).map(e => ({ e, v: SIZE[e.kind].of(e) })).filter(r => r.v != null)
    // Tambora is in the Smithsonian's record from 1812 and in NOAA's on 10 April 1815: the dated one is told
    .sort((a, b) => b.v! - a.v! || b.e.prec - a.e.prec);
  const out: HistoryEvent[] = [];
  for (const { e } of ranked) {
    if (out.length >= n) break;
    if (out.every(o => arc([o.lat, o.lon], [e.lat, e.lon]) >= APART)) out.push(e);
  }
  return out.map(e => told(e, e.title));
}
