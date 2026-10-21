import { msg, type Translate } from '@/lib/core/i18n/translator';
import { mergeOutages, type Outage } from '@/lib/intel/outages/outage';
import { instant, type Spoken } from '../clock';
import { countryName, listOf } from '../places/copy/format';

/** Turns a feed route's answer into the one sentence a page shows. Null when there is nothing true to say. */

export interface LiveLine { text: Spoken; at: number }

const NEXT_LAUNCH = msg('Next launch: {name}, {day} at {time}.');
const AURORA_AT = msg('NOAA’s nowcast for {time} puts the highest chance of seeing the aurora anywhere at {pct}%.');
const ISS_AT = msg('At {time} the ISS was over {lat}, {lon}, {alt} km up, moving at about 7.7 km a second.');
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
  return { text: [text], at: now };
}

interface LaunchRow { name: string; net: string; provider: string | null; location: string | null; status: string }

export function launchLine(json: { launches?: LaunchRow[] } | null, now: number, t: Translate): LiveLine | null {
  const next = (json?.launches ?? [])
    .filter(l => Date.parse(l.net) > now)
    .sort((a, b) => Date.parse(a.net) - Date.parse(b.net))[0];
  if (!next) return null;
  const at = Date.parse(next.net);
  const parts: string[] = [];
  if (next.provider && next.location) parts.push(t('By {provider}, from {location}.', { provider: next.provider, location: next.location }));
  else if (next.provider) parts.push(t('By {provider}.', { provider: next.provider }));
  else if (next.location) parts.push(t('From {location}.', { location: next.location }));
  if (next.status !== 'Go') parts.push(t('The date is not yet confirmed.'));
  const first = t.parts(NEXT_LAUNCH, { name: next.name, day: instant(at, 'day'), time: instant(at) }) as Spoken;
  return { text: [...first, ...parts.map(p => ` ${p}`)], at: now };
}

export function auroraLine(json: { max_pct?: number; forecast_at?: string } | null, now: number, t: Translate): LiveLine | null {
  const pct = json?.max_pct;
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return null;
  const at = json?.forecast_at ? Date.parse(json.forecast_at) : NaN;
  const text = Number.isFinite(at)
    ? t.parts(AURORA_AT, { pct: Math.round(pct), time: instant(at) }) as Spoken
    : [t('NOAA’s nowcast puts the highest chance of seeing the aurora anywhere at {pct}%.', { pct: Math.round(pct) })];
  return { text, at: now };
}

interface SatRow { name: string; lat: number; lng: number; alt: number }

export function issLine(json: { satellites?: SatRow[]; source?: string; timestamp?: string } | null, now: number, t: Translate): LiveLine | null {
  // The route answers with a years-old fallback element set when CelesTrak hasn't loaded; that position would be wrong.
  if (!json || json.source === 'emergency-fallback') return null;
  const iss = json.satellites?.[0];
  if (!iss || !Number.isFinite(iss.lat) || !Number.isFinite(iss.lng)) return null;
  const at = json.timestamp ? Date.parse(json.timestamp) : now;
  const vars = { time: instant(at), lat: deg(t, iss.lat, 'N', 'S'), lon: deg(t, iss.lng, 'E', 'W'), alt: iss.alt };
  return { text: t.parts(ISS_AT, vars) as Spoken, at };
}

const NAMED_OUTAGES = 5;

/** The countries where Cloudflare Radar or IODA still lists an outage as open, with the networks when only networks are out. */
export function outageLine(cloudflare: { outages?: Outage[] } | null, ioda: { outages?: Outage[] } | null, now: number, t: Translate): LiveLine | null {
  if (!cloudflare?.outages && !ioda?.outages) return null;
  const open = mergeOutages(cloudflare?.outages ?? [], ioda?.outages ?? [], now).filter(o => o.ongoing);
  if (!open.length) return { text: [t('Cloudflare Radar and IODA list no internet outage as still going on.')], at: now };
  const byCountry = new Map<string, Set<string> | null>();
  for (const o of open) {
    const seen = byCountry.get(o.country);
    if (!o.network || seen === null) { byCountry.set(o.country, null); continue; }
    const networks = seen ?? new Set<string>();
    for (const n of o.network.split(', ')) networks.add(n.replace(/^AS\d+ /, ''));
    byCountry.set(o.country, networks);
  }
  const names = [...byCountry].map(([cc, networks]) => (networks ? `${countryName(cc, t)} (${[...networks].join(', ')})` : countryName(cc, t)));
  const shown = names.length > NAMED_OUTAGES
    ? [...names.slice(0, NAMED_OUTAGES), t('{n, plural, one {one more} other {# more}}', { n: names.length - NAMED_OUTAGES })]
    : names;
  return {
    text: [t('Internet outages still going on in {n, plural, one {one country} other {# countries}}, per Cloudflare Radar and IODA: {list}.', { n: names.length, list: listOf(shown, t) })],
    at: now,
  };
}
