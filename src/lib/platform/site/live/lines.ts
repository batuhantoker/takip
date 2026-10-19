import type { Translate } from '@/lib/core/i18n/translator';

/** Turns a feed route's answer into the one sentence a page shows. Null when there is nothing true to say. */

export interface LiveLine { text: string; asOf: string }

const clock = (t: Translate, at: number) =>
  `${new Intl.DateTimeFormat(t.intl, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(at)} UTC`;
const day = (t: Translate, at: number) =>
  new Intl.DateTimeFormat(t.intl, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(at);
const fixed = (t: Translate, v: number) => new Intl.NumberFormat(t.intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);
// N, S, E and W stay as they are, like other unit symbols.
const deg = (t: Translate, v: number, pos: string, neg: string) => `${fixed(t, Math.abs(v))}° ${v >= 0 ? pos : neg}`;

interface QuakeRow { magnitude: number; place: string; time: number }

export function quakeLine(json: { earthquakes?: QuakeRow[] } | null, now: number, t: Translate): LiveLine | null {
  const rows = (json?.earthquakes ?? []).filter(q => Number.isFinite(q.magnitude) && q.time >= now - 86_400_000);
  if (!rows.length) return null;
  const n = rows.filter(q => q.magnitude >= 4.5).length;
  const top = rows.reduce((a, b) => (b.magnitude > a.magnitude ? b : a));
  const vars = { n, mag: fixed(t, top.magnitude), place: top.place };
  const text = n
    ? t('{n, plural, one {One earthquake} other {# earthquakes}} of magnitude 4.5 or more in the last 24 hours. The strongest: M{mag}, {place}.', vars)
    : t('No earthquake of magnitude 4.5 or more in the last 24 hours. The strongest: M{mag}, {place}.', vars);
  return { text, asOf: clock(t, now) };
}

interface LaunchRow { name: string; net: string; provider: string | null; location: string | null; status: string }

export function launchLine(json: { launches?: LaunchRow[] } | null, now: number, t: Translate): LiveLine | null {
  const next = (json?.launches ?? [])
    .filter(l => Date.parse(l.net) > now)
    .sort((a, b) => Date.parse(a.net) - Date.parse(b.net))[0];
  if (!next) return null;
  const at = Date.parse(next.net);
  const parts = [t('Next launch: {name}, {day} at {time}.', { name: next.name, day: day(t, at), time: clock(t, at) })];
  if (next.provider && next.location) parts.push(t('By {provider}, from {location}.', { provider: next.provider, location: next.location }));
  else if (next.provider) parts.push(t('By {provider}.', { provider: next.provider }));
  else if (next.location) parts.push(t('From {location}.', { location: next.location }));
  if (next.status !== 'Go') parts.push(t('The date is not yet confirmed.'));
  return { text: parts.join(' '), asOf: clock(t, now) };
}

export function auroraLine(json: { max_pct?: number; forecast_at?: string } | null, now: number, t: Translate): LiveLine | null {
  const pct = json?.max_pct;
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return null;
  const at = json?.forecast_at ? Date.parse(json.forecast_at) : NaN;
  const vars = { pct: Math.round(pct), time: Number.isFinite(at) ? clock(t, at) : '' };
  const text = Number.isFinite(at)
    ? t('NOAA’s nowcast for {time} puts the highest chance of seeing the aurora anywhere at {pct}%.', vars)
    : t('NOAA’s nowcast puts the highest chance of seeing the aurora anywhere at {pct}%.', vars);
  return { text, asOf: clock(t, now) };
}

interface SatRow { name: string; lat: number; lng: number; alt: number }

export function issLine(json: { satellites?: SatRow[]; source?: string; timestamp?: string } | null, now: number, t: Translate): LiveLine | null {
  // The route answers with a years-old fallback element set when CelesTrak hasn't loaded; that position would be wrong.
  if (!json || json.source === 'emergency-fallback') return null;
  const iss = json.satellites?.[0];
  if (!iss || !Number.isFinite(iss.lat) || !Number.isFinite(iss.lng)) return null;
  const at = json.timestamp ? Date.parse(json.timestamp) : now;
  const vars = { time: clock(t, at), lat: deg(t, iss.lat, 'N', 'S'), lon: deg(t, iss.lng, 'E', 'W'), alt: iss.alt };
  return { text: t('At {time} the ISS was over {lat}, {lon}, {alt} km up, moving at about 7.7 km a second.', vars), asOf: clock(t, at) };
}
