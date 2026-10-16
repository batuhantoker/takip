/**
 * The fields TI may filter and sort on, per layer, with their types and units, read off each feed's
 * own row. After God's Eye View's analyst field manifest (src/voice/layerManifest.js, MIT).
 */
import { num, str, time, type Entity, type FindLayer, type Row } from '../catalog';

export type FieldType = 'number' | 'text' | 'flag' | 'time';
export type FieldValue = number | string | boolean | null;

export interface Field {
  type: FieldType;
  unit?: string;
  get: (r: Row, e: Entity) => FieldValue;
}

const n = (k: string) => (r: Row) => num(r[k]);
const t = (k: string) => (r: Row) => str(r[k]) || null;
const at = (k: string) => (r: Row) => time(r[k]);
const flag = (k: string) => (r: Row) => (typeof r[k] === 'boolean' ? r[k] as boolean : null);

const flights: Record<string, Field> = {
  altitude: { type: 'number', unit: 'm', get: n('alt') },
  speed: { type: 'number', unit: 'kn', get: n('speed_knots') },
  heading: { type: 'number', unit: 'deg', get: n('heading') },
  callsign: { type: 'text', get: t('callsign') },
  icao24: { type: 'text', get: t('icao24') },
  registration: { type: 'text', get: r => (str(r.registration) && r.registration !== 'N/A' ? str(r.registration) : null) },
  model: { type: 'text', get: r => (str(r.model) && r.model !== 'Unknown' ? str(r.model) : null) },
  category: { type: 'text', get: t('category') },
  airline: { type: 'text', get: t('airline_code') },
  squawk: { type: 'text', get: t('squawk') },
  emergency: { type: 'flag', get: r => /^7[567]00$/.test(str(r.squawk)) },
  grounded: { type: 'flag', get: flag('grounded') },
  helicopter: { type: 'flag', get: r => r.aircraft_category === 'heli' },
};

export const FIELDS: Record<FindLayer, Record<string, Field>> = {
  flights,
  military_flights: flights,
  ships: {
    speed: { type: 'number', unit: 'kn', get: n('speed') },
    heading: { type: 'number', unit: 'deg', get: n('heading') },
    mmsi: { type: 'text', get: t('mmsi') },
    type: { type: 'text', get: t('type') },
    destination: { type: 'text', get: t('destination') },
    reported: { type: 'time', get: at('timestamp') },
  },
  ports: { country: { type: 'text', get: t('country') }, type: { type: 'text', get: t('type') }, congestion: { type: 'text', get: t('congestion') }, rank: { type: 'number', get: n('rank') } },
  chokepoints: { risk: { type: 'text', get: t('risk') }, traffic: { type: 'text', get: t('traffic') } },
  earthquakes: {
    magnitude: { type: 'number', get: n('magnitude') },
    depth: { type: 'number', unit: 'km', get: n('depth') },
    tsunami: { type: 'flag', get: r => (r.tsunami === undefined ? null : Boolean(num(r.tsunami))) },
    alert: { type: 'text', get: t('alert') },
  },
  news: { risk: { type: 'number', get: n('risk_score') }, source: { type: 'text', get: r => str(r.source_name) || str(r.source) || null } },
  incidents: { type: { type: 'text', get: t('type') } },
  weather: { type: { type: 'text', get: t('type') }, severity: { type: 'text', get: t('severity') }, provider: { type: 'text', get: t('provider') } },
  fires: { power: { type: 'number', unit: 'MW', get: n('frp') }, confidence: { type: 'text', get: t('confidence') } },
  fire_incidents: { area: { type: 'number', unit: 'ha', get: n('sizeHa') }, stage: { type: 'text', get: t('stageLabel') }, agency: { type: 'text', get: t('agency') } },
  fire_perimeters: {
    acres: { type: 'number', get: n('acres') }, contained: { type: 'number', unit: '%', get: n('contained') },
    kind: { type: 'text', get: t('kind') }, state: { type: 'text', get: t('state') }, county: { type: 'text', get: t('county') },
    cause: { type: 'text', get: t('cause') }, discovered: { type: 'time', get: at('discovered') },
  },
  radiation: { dose: { type: 'number', unit: 'nSv/h', get: n('reading') }, status: { type: 'text', get: t('status') }, network: { type: 'text', get: t('network') } },
  air_raid_alerts: { active: { type: 'flag', get: flag('active') }, country: { type: 'text', get: t('country') }, provider: { type: 'text', get: t('provider') } },
  cameras: { city: { type: 'text', get: t('city') }, country: { type: 'text', get: t('country') }, source: { type: 'text', get: t('source') }, offline: { type: 'flag', get: r => r.offline === true } },
  satellites: {
    altitude: { type: 'number', unit: 'km', get: (_r, e) => e.value },
    norad: { type: 'text', get: t('noradId') },
    category: { type: 'text', get: t('category') },
    mission: { type: 'text', get: t('mission') },
  },
  launches: {
    provider: { type: 'text', get: t('provider') }, rocket: { type: 'text', get: t('rocket') }, mission: { type: 'text', get: t('mission') },
    orbit: { type: 'text', get: t('orbit') }, status: { type: 'text', get: t('status_name') }, country: { type: 'text', get: t('country') },
    webcast: { type: 'flag', get: flag('webcast_live') },
  },
  cables: { length: { type: 'number', unit: 'km', get: n('length_km') } },
  infrastructure: { type: { type: 'text', get: t('type') }, status: { type: 'text', get: t('status') }, country: { type: 'text', get: t('country') }, capacity: { type: 'number', unit: 'MW', get: n('capacityMW') }, reactors: { type: 'number', get: n('reactors') } },
};

/** Fields every layer has: `km` only once a query has a centre, `age_h` only where the feed dates its rows. */
export const COMMON: Record<string, Field> = {
  id: { type: 'text', get: (_r, e) => e.id },
  name: { type: 'text', get: (_r, e) => e.title },
  lat: { type: 'number', unit: 'deg', get: (_r, e) => e.lat },
  lng: { type: 'number', unit: 'deg', get: (_r, e) => e.lng },
  time: { type: 'time', get: (_r, e) => e.time },
  /** The layer's headline figure, the one `min` and "largest" use. */
  value: { type: 'number', get: (_r, e) => e.value },
};
export const DERIVED = { km: { type: 'number', unit: 'km' }, age_h: { type: 'number', unit: 'h' } } as const;

/** A field across the queried layers: the first layer that has it decides its type. */
export function fieldOf(layers: FindLayer[], name: string): Field | { type: FieldType; unit?: string; get?: undefined } | null {
  if (name in COMMON) return COMMON[name];
  if (name in DERIVED) return DERIVED[name as keyof typeof DERIVED];
  for (const l of layers) if (FIELDS[l][name]) return FIELDS[l][name];
  return null;
}

export function fieldNames(layers: FindLayer[]): string[] {
  const out = new Set([...Object.keys(COMMON), ...Object.keys(DERIVED)]);
  for (const l of layers) for (const k of Object.keys(FIELDS[l])) out.add(k);
  return [...out];
}

/** One entity's value for a field; `km` and `age_h` come from the query. */
export function valueOf(e: Entity & { km?: number }, name: string, now: number): FieldValue {
  if (name === 'km') return e.km ?? null;
  if (name === 'age_h') return e.time === null ? null : Math.round(((now - e.time) / 3_600_000) * 100) / 100;
  const f = COMMON[name] ?? FIELDS[e.layer][name];
  return f ? f.get(e.raw, e) : null;
}

/* ───────────── Units ───────────── */

const UNIT_ALIASES: Record<string, string> = {
  m: 'm', meter: 'm', meters: 'm', metre: 'm', metres: 'm', ft: 'ft', foot: 'ft', feet: 'ft', km: 'km', kilometers: 'km', kilometres: 'km',
  mi: 'mi', mile: 'mi', miles: 'mi', nm: 'nmi', nmi: 'nmi', 'm/s': 'm/s', mps: 'm/s', kn: 'kn', kt: 'kn', kts: 'kn', knot: 'kn', knots: 'kn',
  'km/h': 'km/h', kmh: 'km/h', kph: 'km/h', mph: 'mph', h: 'h', hr: 'h', hrs: 'h', hour: 'h', hours: 'h', min: 'min', mins: 'min', minutes: 'min',
  d: 'd', day: 'd', days: 'd', deg: 'deg', degrees: 'deg', '°': 'deg', fl: 'fl',
};
const UNIT_SCALE: Record<string, [string, number]> = {
  m: ['length', 1], ft: ['length', 0.3048], fl: ['length', 30.48], km: ['length', 1000], mi: ['length', 1609.344], nmi: ['length', 1852],
  'm/s': ['speed', 1], kn: ['speed', 1852 / 3600], 'km/h': ['speed', 1 / 3.6], mph: ['speed', 0.44704],
  h: ['time', 3600], min: ['time', 60], d: ['time', 86400],
};

export const canonicalUnit = (u: string) => UNIT_ALIASES[u.trim().toLowerCase()] ?? u.trim().toLowerCase();

/** Turns a value in `given` into the field's own unit; null when they do not convert ("ft" to "kn"). */
export function unitFactor(given: string, fieldUnit: string | undefined): number | null {
  if (!fieldUnit) return null;
  const from = canonicalUnit(given), to = canonicalUnit(fieldUnit);
  if (from === to) return 1;
  const a = UNIT_SCALE[from], b = UNIT_SCALE[to];
  return a && b && a[0] === b[0] ? a[1] / b[1] : null;
}
