import type { RawEnvelope } from '@takip/archive/envelope';
import { Prec } from '@takip/core/time';
import { GeoPrec } from '@takip/db';
import type { Connector, EventObservation } from '../observation';

/*
 * USGS ComCat (US federal work, public domain). The summary feed is a CDN file refreshed every minute;
 * the FDSN query reaches back to 1900 but answers at most 20,000 events per request.
 */

export const USGS_FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
const FDSN = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
export const MIN_MAG = 2.5;

export function usgsQuery({ from, to, minMag = MIN_MAG, updatedAfter }: { from: number; to?: number; minMag?: number; updatedAfter?: number }) {
  const q = new URLSearchParams({ format: 'geojson', eventtype: 'earthquake', orderby: 'time-asc', minmagnitude: String(minMag), starttime: iso(from) });
  if (to !== undefined) q.set('endtime', iso(to));
  if (updatedAfter !== undefined) q.set('updatedafter', iso(updatedAfter));
  return `${FDSN}?${q}`;
}

const iso = (t: number) => new Date(t).toISOString().slice(0, 19);

type Feature = {
  id?: unknown;
  geometry?: { coordinates?: unknown[] } | null;
  properties?: Record<string, unknown> | null;
};

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

export function quakeEvent(f: Feature): EventObservation | undefined {
  const p = f.properties;
  const [lon = null, lat = null, depth = null] = (f.geometry?.coordinates ?? []).map(num);
  const time = num(p?.time);
  if (typeof f.id !== 'string' || !p || time === null || lon === null || lat === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return undefined;
  if (p.type !== undefined && p.type !== 'earthquake') return undefined;
  const mag = num(p.mag);
  const place = str(p.place);
  const ids = str(p.ids);
  return {
    shape: 'event',
    kind: 'hazard.quake',
    sourceRecordId: f.id,
    title: str(p.title) ?? (mag === null ? place : `M ${mag.toFixed(1)}${place ? ` - ${place}` : ''}`),
    tStart: time,
    tStartPrec: Prec.second,
    lon,
    lat,
    geoPrec: GeoPrec.exact,
    magnitude: mag,
    supersedes: ids?.split(',').filter(id => id && id !== f.id),
    attrs: {
      depth_km: depth,
      place,
      mag_type: str(p.magType),
      alert: str(p.alert),
      tsunami: num(p.tsunami) === 1,
      felt: num(p.felt),
      sig: num(p.sig),
      status: str(p.status),
      net: str(p.net),
      ids,
      url: str(p.url) ?? `https://earthquake.usgs.gov/earthquakes/eventpage/${f.id}`,
    },
  };
}

export const usgs: Connector = {
  source: 'usgs',
  *map(env: RawEnvelope) {
    if ((env.status ?? 200) >= 300) return;
    const features = (env.body as { features?: unknown } | null)?.features;
    if (!Array.isArray(features)) return;
    for (const f of features) {
      const ev = f && typeof f === 'object' ? quakeEvent(f as Feature) : undefined;
      if (ev) yield ev;
    }
  },
};
