/**
 * TAKIP — Ukrainian air-raid alert state per oblast, via the Ubilling
 * project's public mirror of the official alert API, no key. No stated
 * licence; permission pending.
 *
 * alerts.com.ua, the obvious keyless mirror, was checked on 2026-10-12 and is
 * stale for every oblast but Kyiv city: it showed 2 alerts while this one
 * showed 16 during the same attack. A stale mirror reads as an all-clear, so
 * this one's `cachedat` is checked before anything is believed. The official
 * api.ukrainealarm.com and alerts.in.ua need keys.
 *
 * Times are Kyiv local. `changed` is often the 1970 epoch, meaning unknown.
 * Occupied Luhansk and Sevastopol sit in permanent alert.
 */

import type { WarAlert } from './types';

export const UA_ALERTS_URL = 'https://ubilling.net.ua/aerialalerts/';
export const STALE_AFTER_MS = 10 * 60_000;

/** Oblast name as the mirror spells it → English name and administrative centre (Kramatorsk for Donetsk, which is occupied). */
export const OBLASTS: Record<string, [en: string, lat: number, lng: number]> = {
  'Вінницька область': ['Vinnytsia oblast', 49.2331, 28.4682],
  'Волинська область': ['Volyn oblast', 50.7472, 25.3254],
  'Дніпропетровська область': ['Dnipropetrovsk oblast', 48.4647, 35.0462],
  'Донецька область': ['Donetsk oblast', 48.7389, 37.5848],
  'Житомирська область': ['Zhytomyr oblast', 50.2547, 28.6587],
  'Закарпатська область': ['Zakarpattia oblast', 48.6208, 22.2879],
  'Запорізька область': ['Zaporizhzhia oblast', 47.8388, 35.1396],
  'Івано-Франківська область': ['Ivano-Frankivsk oblast', 48.9226, 24.7111],
  // Kyiv city is its own entry, so the oblast sits south of it rather than on top of it.
  'Київська область': ['Kyiv oblast', 50.0533, 30.7667],
  'Кіровоградська область': ['Kirovohrad oblast', 48.5079, 32.2623],
  'Луганська область': ['Luhansk oblast', 48.574, 39.3078],
  'Львівська область': ['Lviv oblast', 49.8397, 24.0297],
  'Миколаївська область': ['Mykolaiv oblast', 46.975, 31.9946],
  'Одеська область': ['Odesa oblast', 46.4825, 30.7233],
  'Полтавська область': ['Poltava oblast', 49.5883, 34.5514],
  'Рівненська область': ['Rivne oblast', 50.6199, 26.2516],
  'Сумська область': ['Sumy oblast', 50.9077, 34.7981],
  'Тернопільська область': ['Ternopil oblast', 49.5535, 25.5948],
  'Харківська область': ['Kharkiv oblast', 49.9935, 36.2304],
  'Херсонська область': ['Kherson oblast', 46.6354, 32.6169],
  'Хмельницька область': ['Khmelnytskyi oblast', 49.4229, 26.9871],
  'Черкаська область': ['Cherkasy oblast', 49.4444, 32.0598],
  'Чернівецька область': ['Chernivtsi oblast', 48.2921, 25.9358],
  'Чернігівська область': ['Chernihiv oblast', 51.4982, 31.2893],
  'м. Київ': ['Kyiv', 50.4501, 30.5234],
  'Севастополь': ['Sevastopol', 44.6167, 33.5254],
  'АР Крим': ['Crimea', 44.9521, 34.1024],
};

/** `YYYY-MM-DD HH:MM:SS` in Europe/Kyiv → epoch ms, DST included. */
export function kyivTime(s: string | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec((s ?? '').trim());
  if (!m) return null;
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  const offset = (t: number) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Kyiv', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        .formatToParts(new Date(t)).map(x => [x.type, x.value]),
    );
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t;
  };
  const guess = asUtc - offset(asUtc);
  return asUtc - offset(guess);
}

export interface UaParsed {
  alerts: WarAlert[];
  /** When the mirror last refreshed from upstream. */
  at: number | null;
  unknown: string[];
}

export function parseUaStates(json: unknown): UaParsed {
  const body = json as { cachedat?: string; states?: Record<string, { alertnow?: boolean; changed?: string }> } | null;
  if (!body?.states || typeof body.states !== 'object') throw new Error('Ukraine alerts: unexpected shape');
  const alerts: WarAlert[] = [];
  const unknown: string[] = [];
  for (const [name, state] of Object.entries(body.states)) {
    const anchor = OBLASTS[name];
    if (!anchor) { unknown.push(name); continue; }
    if (state?.alertnow !== true) continue;
    const changed = kyivTime(state.changed);
    const [en, lat, lng] = anchor;
    alerts.push({
      id: `ua-${en.toLowerCase().replace(/[^a-z]+/g, '-')}`,
      country: 'UA',
      place: en,
      lat,
      lng,
      precision: 'oblast',
      threat: 'air-raid',
      label: 'Air-raid alert',
      active: true,
      // Before 2000 is the mirror's "unknown" placeholder.
      since: changed != null && changed > Date.UTC(2000, 0, 1) ? new Date(changed).toISOString() : undefined,
      provider: 'ubilling.net.ua',
      source: 'https://map.ukrainealarm.com/',
    });
  }
  return { alerts, at: kyivTime(body.cachedat), unknown };
}
