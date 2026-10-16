import type { RtVehicle } from '../gtfs/realtime';

/**
 * Barcelona's FGC trains (metro lines L6, L7, L8, L12 and the suburban S and R lines) from its Opendatasoft
 * open-data portal: keyless GPS positions, updated about every 30 s. Licence CC BY 4.0, per the portal.
 */
export const FGC_URL = 'https://dadesobertes.fgc.cat/api/explore/v2.1/catalog/datasets/posicionament-dels-trens/records?limit=100';

interface Record_ {
  id?: string;
  /** The train unit, steadier than the record id. */
  ut?: string;
  lin?: string;
  geo_point_2d?: { lon?: number; lat?: number };
  properes_parades?: string;
}

/** Throws on anything but `{ results: [...] }`. */
export function parseFgc(text: string, nowS: number): RtVehicle[] {
  const body = JSON.parse(text) as { results?: Record_[] };
  if (!Array.isArray(body.results)) throw new Error('FGC: no results');
  return body.results.flatMap(r => {
    const lat = r.geo_point_2d?.lat, lng = r.geo_point_2d?.lon, id = r.ut || r.id;
    if (!id || lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    return [{ id, lat, lng, route: r.lin, mode: /^L\d/.test(r.lin ?? '') ? 'metro' as const : 'rail' as const, t: Math.round(nowS) }];
  });
}
