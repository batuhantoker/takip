/**
 * TAKIP — Israeli Home Front Command sirens via Tzeva Adom, no key, no proxy.
 * Unofficial community API with no published terms; permission pending.
 *
 * `notifications` holds only sirens sounding right now (usually `[]`), so the
 * recent `alerts-history` waves are read too. Both name places in Hebrew;
 * Tzeva Adom's own `cities.json` gives the English name and a point. The
 * official oref.org.il feed needs an Israeli IP and is not used.
 */

import type { WarAlert, WarThreat } from './types';

export const TZEVA_NOTIFICATIONS_URL = 'https://api.tzevaadom.co.il/notifications';
export const TZEVA_HISTORY_URL = 'https://api.tzevaadom.co.il/alerts-history';
export const TZEVA_CITIES_URL = 'https://www.tzevaadom.co.il/static/cities.json';

/** Tzeva Adom threat ids, from its web client. 9 is a drill. */
const THREATS: Record<number, [WarThreat, string]> = {
  0: ['rockets', 'Rockets and missiles'],
  1: ['hazmat', 'Hazardous materials'],
  2: ['infiltration', 'Suspected infiltration'],
  3: ['earthquake', 'Earthquake'],
  4: ['tsunami', 'Tsunami'],
  5: ['uav', 'Hostile aircraft (UAV)'],
  6: ['nonconventional', 'Non-conventional missile'],
  7: ['radiological', 'Radiological event'],
  8: ['general', 'General alert'],
};
const DRILL = 9;

export const ACTIVE_FOR_MS = 10 * 60_000;
export const WINDOW_MS = 24 * 3_600_000;

export interface TzevaCity {
  en: string;
  lat: number;
  lng: number;
}

export interface Siren {
  t: number;
  cities: string[];
  threat: number;
}

export function parseTzevaCities(json: unknown): Map<string, TzevaCity> {
  const cities = (json as { cities?: unknown } | null)?.cities;
  if (!cities || typeof cities !== 'object') throw new Error('Tzeva Adom: unexpected cities.json shape');
  const out = new Map<string, TzevaCity>();
  for (const [he, c] of Object.entries(cities as Record<string, Partial<TzevaCity>>)) {
    if (typeof c?.lat === 'number' && typeof c?.lng === 'number' && (c.lat !== 0 || c.lng !== 0)) {
      out.set(he, { en: c.en || he, lat: c.lat, lng: c.lng });
    }
  }
  return out;
}

/** Epoch seconds, epoch ms or an ISO string. */
function toMs(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v < 1e12 ? v * 1000 : v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return toMs(n);
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

function toSiren(raw: Record<string, unknown>): Siren | null {
  if (raw.isDrill === true || raw.threat === DRILL) return null;
  const t = toMs(raw.time ?? raw.date);
  const cities = Array.isArray(raw.cities) ? raw.cities.filter((c): c is string => typeof c === 'string') : [];
  const threat = typeof raw.threat === 'number' ? raw.threat : 8;
  return t != null && cities.length ? { t, cities, threat } : null;
}

/** `notifications`: a flat array of sirens. */
export function parseTzevaNotifications(json: unknown): Siren[] {
  if (!Array.isArray(json)) throw new Error('Tzeva Adom: unexpected notifications shape');
  return json.flatMap(n => (n && typeof n === 'object' ? [toSiren(n as Record<string, unknown>)].filter((s): s is Siren => s !== null) : []));
}

/** `alerts-history`: waves, each with its own `alerts` array. */
export function parseTzevaHistory(json: unknown): Siren[] {
  if (!Array.isArray(json)) throw new Error('Tzeva Adom: unexpected alerts-history shape');
  return json.flatMap(w => parseTzevaNotifications(Array.isArray(w?.alerts) ? w.alerts : []));
}

/** One alert per place and threat, keeping the latest siren and counting the rest. */
export function sirensToAlerts(sirens: Siren[], cities: Map<string, TzevaCity>, now: number): { alerts: WarAlert[]; unplaced: string[] } {
  const latest = new Map<string, { siren: Siren; city: TzevaCity; he: string; count: number }>();
  const unplaced = new Set<string>();
  for (const s of sirens) {
    if (now - s.t > WINDOW_MS || s.t - now > 60_000) continue;
    for (const he of s.cities) {
      const city = cities.get(he);
      if (!city) { unplaced.add(he); continue; }
      const key = `${he}|${s.threat}`;
      const prev = latest.get(key);
      if (!prev) latest.set(key, { siren: s, city, he, count: 1 });
      else latest.set(key, { siren: s.t > prev.siren.t ? s : prev.siren, city, he, count: prev.count + 1 });
    }
  }
  const alerts = [...latest.values()].map(({ siren, city, he, count }) => {
    const [threat, label] = THREATS[siren.threat] ?? THREATS[8];
    return {
      id: `il-${threat}-${he}`,
      country: 'IL' as const,
      place: city.en,
      lat: city.lat,
      lng: city.lng,
      precision: 'locality' as const,
      threat,
      label,
      active: now - siren.t <= ACTIVE_FOR_MS,
      since: new Date(siren.t).toISOString(),
      count,
      provider: 'Tzeva Adom' as const,
      source: 'https://www.tzevaadom.co.il/en/',
    };
  });
  return { alerts: alerts.sort((a, b) => (b.since ?? '').localeCompare(a.since ?? '')), unplaced: [...unplaced] };
}
