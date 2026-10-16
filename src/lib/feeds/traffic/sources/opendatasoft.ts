import type { Bbox, TrafficLevel, TrafficSegment, TrafficSourceId } from '../types';

/**
 * City traffic states on Opendatasoft portals (Explore v2.1): road segments with inline lines,
 * the measured speed and the provider's own traffic class. No "usual" speed, so the tint follows
 * the class and the hover shows the class word, never a derived percentage.
 */
export interface OdsCity {
  id: TrafficSourceId;
  label: string;
  bbox: Bbox;
  host: string;
  dataset: string;
  fields: { id: string; name: string; time: string; speed: string; status: string; probes?: string };
  /** The class words that mean slow or jammed; any other class draws nothing. */
  levels: Record<string, TrafficLevel>;
  minProbes?: number;
  page: string;
  licence: string;
}

export const ODS_CITIES: OdsCity[] = [
  {
    // Floating car data from Autoroutes Trafic, 3 min behind by design; 7,000 calls a day per IP.
    id: 'rennes', label: 'Rennes Métropole', bbox: [-2.0, 47.95, -1.45, 48.3],
    host: 'data.rennesmetropole.fr', dataset: 'etat-du-trafic-en-temps-reel',
    fields: { id: 'predefinedlocationreference', name: 'denomination', time: 'datetime', speed: 'averagevehiclespeed', status: 'trafficstatus', probes: 'vehicleprobemeasurement' },
    levels: { heavy: 'slow', congested: 'jam', impossible: 'jam' },
    // At night most "heavy" rests on one or two cars.
    minProbes: 3,
    page: 'https://data.rennesmetropole.fr/explore/dataset/etat-du-trafic-en-temps-reel/', licence: 'ODbL',
  },
  {
    id: 'nantes', label: 'Nantes Métropole', bbox: [-1.85, 47.08, -1.35, 47.35],
    host: 'data.nantesmetropole.fr', dataset: '244400404_fluidite-axes-routiers-nantes-metropole',
    fields: { id: 'cha_id', name: 'cha_lib', time: 'mf1_hd', speed: 'mf1_vit', status: 'etat_trafic' },
    levels: { Dense: 'slow', 'Saturé': 'jam' },
    page: 'https://data.nantesmetropole.fr/explore/dataset/244400404_fluidite-axes-routiers-nantes-metropole/', licence: 'ODbL',
  },
];

const MAX_AGE_MS = 20 * 60_000;

/** Only the congested rows and the fields used, so a quiet evening is a few kilobytes. */
export function odsExportUrl(city: OdsCity): string {
  const f = city.fields;
  const statuses = Object.keys(city.levels).map(s => `"${s}"`).join(',');
  const select = [f.id, f.name, f.time, f.speed, f.status, f.probes, 'geo_shape'].filter(Boolean).join(',');
  const q = new URLSearchParams({ where: `${f.status} in (${statuses})`, select });
  return `https://${city.host}/api/explore/v2.1/catalog/datasets/${city.dataset}/exports/geojson?${q}`;
}

interface OdsFeature {
  geometry?: { type?: string; coordinates?: unknown } | null;
  properties?: Record<string, unknown> | null;
}

export function odsSegments(city: OdsCity, json: unknown, now = Date.now()): TrafficSegment[] {
  const features = (json as { features?: OdsFeature[] } | null)?.features ?? [];
  const f = city.fields;
  const out: TrafficSegment[] = [];
  for (const feat of features) {
    const p = feat.properties ?? {};
    const status = String(p[f.status] ?? '');
    const level = city.levels[status];
    if (!level || feat.geometry?.type !== 'LineString') continue;
    if (city.minProbes && f.probes && !(Number(p[f.probes]) >= city.minProbes)) continue;
    const t = Date.parse(String(p[f.time] ?? ''));
    if (!Number.isFinite(t) || now - t > MAX_AGE_MS) continue;
    const coords = (feat.geometry.coordinates as [number, number][]).filter(c => Number.isFinite(c?.[0]) && Number.isFinite(c?.[1]));
    if (coords.length < 2) continue;
    const kmh = Number(p[f.speed]);
    const name = typeof p[f.name] === 'string' ? (p[f.name] as string).trim() : '';
    out.push({
      id: `${city.id}:${p[f.id]}`, source: city.id, level, coords, at: new Date(t).toISOString(), status,
      ...(kmh > 0 && { kmh: Math.round(kmh) }), ...(name && { name }),
    });
  }
  return out;
}
