import { haversine, type LngLat } from '@/lib/core/geodesic';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import { viewPath } from '@/lib/map/view-link';
import type { Hit } from '@/lib/feeds/weather/near/pixels';

/*
 * What is happening near one point right now, in a few lines: the phone apps' widget (and through it CarPlay) reads
 * this from /api/near-now. Each kind keeps its nearest or strongest case; the list is ranked by how much it matters
 * to someone there, and the words come translated, so the widget only lays them out.
 */

export type NearKind = 'warning' | 'earthquake' | 'fire' | 'lightning' | 'rain';
export type NearItem = { kind: NearKind; title: string; detail: string; km: number; path: string; rank: number };

export type Quake = { lat: number; lng: number; magnitude: number; time: number; place?: string };
export type FireIncident = { lat: number; lng: number; name: string; sizeHa?: number };
export type Hotspot = { lat: number; lng: number; type: string; confidence: string; date: string; time: string };
export type Alert = { lat: number; lng: number; title: string; severity: string; expires?: string };

export type NearInputs = {
  at: LngLat;
  now: number;
  quakes: Quake[];
  incidents: FireIncident[];
  hotspots: Hotspot[];
  alerts: Alert[];
  /** The newest frame's time and the nearest hit, from lightningNear and rainNear. */
  lightning: { at: number; nearest: Hit | null } | null;
  rain: { at: number; nearest: Hit | null } | null;
};

export const QUAKE_KM = 300;
export const QUAKE_MIN_MAG = 2.5;
export const INCIDENT_KM = 100;
export const HOTSPOT_KM = 25;
/** Warnings are placed by the middle of their area, so the radius is generous and the text says "about". */
export const ALERT_KM = 100;
const DAY_MS = 24 * 3600_000;
/** The widget's lines; a page asks for every kind (`limit`). */
export const MAX_ITEMS = 4;

const ZOOM = 8;
const mapAt = (lat: number, lng: number, layer: string) => viewPath({ lat, lng, zoom: ZOOM, layers: { [layer]: true } });

/** "2 hours ago", in the reader's language. */
function ago(t: Translate, then: number, now: number): string {
  const minutes = Math.max(0, Math.round((now - then) / 60_000));
  const rtf = new Intl.RelativeTimeFormat(t.intl, { numeric: 'auto', style: 'short' });
  return minutes < 60 ? rtf.format(-minutes, 'minute') : minutes < 48 * 60 ? rtf.format(-Math.round(minutes / 60), 'hour') : rtf.format(-Math.round(minutes / 1440), 'day');
}

// Whole numbers, rounded as people say them ("10 mi", not "9.9 mi"): the widget is read at a glance.
const DETAIL = msg('{km, radius} · {ago}');

/** FIRMS gives the pass as a UTC date and an hhmm time. */
const hotspotTime = (h: Hotspot) => Date.parse(`${h.date}T${h.time.padStart(4, '0').replace(/(\d\d)(\d\d)/, '$1:$2')}:00Z`);

function nearest<T extends { lat: number; lng: number }>(at: LngLat, rows: T[], maxKm: number, keep: (row: T) => boolean = () => true) {
  let best: { row: T; km: number } | null = null;
  for (const row of rows) {
    if (!keep(row)) continue;
    const km = haversine(at, [row.lng, row.lat]);
    if (km <= maxKm && (!best || km < best.km)) best = { row, km };
  }
  return best;
}

export function nearItems(input: NearInputs, t: Translate, limit = MAX_ITEMS): NearItem[] {
  const { at, now } = input;
  const items: NearItem[] = [];

  const alert = nearest(at, input.alerts, ALERT_KM, a => !a.expires || Date.parse(a.expires) > now);
  if (alert) {
    items.push({
      kind: 'warning', title: alert.row.title, km: alert.km, rank: alert.row.severity === 'high' ? 95 : 75,
      detail: t('About {km, radius} away', { km: alert.km }), path: mapAt(alert.row.lat, alert.row.lng, 'weather'),
    });
  }

  // The strongest quake in reach, not the nearest: a distant M6 matters more than a nearby M2.6.
  const quakes = input.quakes
    .filter(q => q.magnitude >= QUAKE_MIN_MAG && now - q.time <= DAY_MS)
    .map(q => ({ q, km: haversine(at, [q.lng, q.lat]) }))
    .filter(x => x.km <= QUAKE_KM)
    .sort((a, b) => b.q.magnitude - a.q.magnitude || a.km - b.km);
  if (quakes[0]) {
    const { q, km } = quakes[0];
    items.push({
      kind: 'earthquake', km, rank: q.magnitude >= 5 ? 90 : q.magnitude >= 4 ? 70 : 40,
      title: t('M{mag} earthquake', { mag: q.magnitude.toFixed(1) }),
      detail: t(DETAIL, { km, ago: ago(t, q.time, now) }), path: mapAt(q.lat, q.lng, 'earthquakes'),
    });
  }

  const incident = nearest(at, input.incidents, INCIDENT_KM);
  // Satellite hotspots only when no named fire is near; volcanoes in the feed carry placeholder readings.
  const hotspot = incident ? null : nearest(at, input.hotspots, HOTSPOT_KM, h => h.type === 'fire' && h.confidence !== 'low');
  if (incident) {
    items.push({
      kind: 'fire', km: incident.km, rank: 80, title: incident.row.name,
      detail: t('Wildfire · {km, radius}', { km: incident.km }), path: mapAt(incident.row.lat, incident.row.lng, 'fires'),
    });
  } else if (hotspot) {
    const seen = hotspotTime(hotspot.row);
    items.push({
      kind: 'fire', km: hotspot.km, rank: 55, title: t('Fire seen by satellite'),
      detail: Number.isFinite(seen) ? t(DETAIL, { km: hotspot.km, ago: ago(t, seen, now) }) : t('{km, radius}', { km: hotspot.km }),
      path: mapAt(hotspot.row.lat, hotspot.row.lng, 'fires'),
    });
  }

  const strike = input.lightning?.nearest;
  if (input.lightning && strike) {
    items.push({
      kind: 'lightning', km: strike.km, rank: 65, title: t('Lightning'),
      detail: t(DETAIL, { km: strike.km, ago: ago(t, input.lightning.at, now) }), path: mapAt(at[1], at[0], 'wx_lightning'),
    });
  }

  const rain = input.rain?.nearest;
  if (input.rain && rain) {
    items.push({
      kind: 'rain', km: rain.km, rank: 10, title: t('Rain'),
      detail: rain.km < 1 ? t('Here now') : t('{km, radius}', { km: rain.km }), path: mapAt(at[1], at[0], 'wx_radar'),
    });
  }

  return items.sort((a, b) => b.rank - a.rank || a.km - b.km).slice(0, limit);
}

/** [west, south, east, north]; west > east crosses the antimeridian. */
export type Box = [number, number, number, number];
export type AreaInputs = Omit<NearInputs, 'at' | 'lightning' | 'rain'> & { box: Box };

const inBox = ([w, s, e, n]: Box, lng: number, lat: number) => lat >= s && lat <= n && (w <= e ? lng >= w && lng <= e : lng >= w || lng <= e);

/**
 * The same for a whole country: nothing is "nearest" to a country, so each kind says how many there are inside its box
 * and names one. Lightning and rain are read around a point, so they stay with the country's cities.
 */
export function areaItems(input: AreaInputs, t: Translate, limit = MAX_ITEMS): NearItem[] {
  const { box, now } = input;
  const inside = <T extends { lat: number; lng: number }>(rows: T[]) => rows.filter(r => inBox(box, r.lng, r.lat));
  const items: NearItem[] = [];

  const alerts = inside(input.alerts).filter(a => !a.expires || Date.parse(a.expires) > now);
  if (alerts.length) {
    const top = alerts.find(a => a.severity === 'high') ?? alerts[0];
    items.push({
      kind: 'warning', km: 0, rank: top.severity === 'high' ? 95 : 75, path: mapAt(top.lat, top.lng, 'weather'),
      title: t('{n, plural, one {# warning in force} other {# warnings in force}}', { n: alerts.length }), detail: top.title,
    });
  }

  const quakes = inside(input.quakes).filter(q => q.magnitude >= QUAKE_MIN_MAG && now - q.time <= DAY_MS);
  if (quakes.length) {
    const q = quakes.reduce((a, b) => (b.magnitude > a.magnitude ? b : a));
    items.push({
      kind: 'earthquake', km: 0, rank: q.magnitude >= 5 ? 90 : q.magnitude >= 4 ? 70 : 40, path: mapAt(q.lat, q.lng, 'earthquakes'),
      title: t('M{mag} earthquake', { mag: q.magnitude.toFixed(1) }),
      detail: q.place ? t('{place} · {ago}', { place: q.place, ago: ago(t, q.time, now) }) : ago(t, q.time, now),
    });
  }

  const fires = inside(input.incidents);
  const spots = fires.length ? [] : inside(input.hotspots).filter(h => h.type === 'fire' && h.confidence !== 'low');
  if (fires.length) {
    const big = fires.reduce((a, b) => ((b.sizeHa ?? 0) > (a.sizeHa ?? 0) ? b : a));
    items.push({
      kind: 'fire', km: 0, rank: 80, path: mapAt(big.lat, big.lng, 'fires'),
      title: fires.length > 1 ? t('{n, plural, one {# named fire} other {# named fires}}', { n: fires.length }) : big.name,
      detail: fires.length > 1 ? t('Largest: {name}', { name: big.name }) : t('Wildfire'),
    });
  } else if (spots.length) {
    items.push({
      kind: 'fire', km: 0, rank: 55, path: mapAt(spots[0].lat, spots[0].lng, 'fires'),
      title: t('{n, plural, one {# fire seen by satellite} other {# fires seen by satellite}}', { n: spots.length }), detail: t('In the last day'),
    });
  }

  return items.sort((a, b) => b.rank - a.rank).slice(0, limit);
}
