import { httpJson } from '@/lib/core/net/http-json';

/*
 * US wildfire perimeters: NIFC's WFIGS Interagency Perimeters (current), the agencies' own mapped
 * edges, keyless. US government data, public domain.
 */

const QUERY = 'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query';
const FIELDS = [
  'poly_IncidentName', 'attr_IncidentName', 'poly_GISAcres', 'attr_IncidentSize', 'attr_PercentContained',
  'attr_FireDiscoveryDateTime', 'poly_DateCurrent', 'poly_PolygonDateTime', 'attr_POOState', 'attr_POOCounty',
  'attr_IncidentTypeCategory', 'attr_FireCause', 'attr_UniqueFireIdentifier', 'poly_IRWINID',
];
const PAGE = 2000;
const MAX_PAGES = 5;

export function wfigsUrl(offset = 0): string {
  const q = new URLSearchParams({
    where: '1=1',
    outFields: FIELDS.join(','),
    returnGeometry: 'true',
    // ~100 m of simplification keeps a whole US season near 1 MB.
    maxAllowableOffset: '0.001',
    geometryPrecision: '4',
    outSR: '4326',
    resultOffset: String(offset),
    resultRecordCount: String(PAGE),
    orderByFields: 'OBJECTID',
    f: 'geojson',
  });
  return `${QUERY}?${q}`;
}

export interface PerimeterProps {
  id: string;
  name: string;
  acres: number | null;
  /** Percent contained, when the incident reports it. */
  contained: number | null;
  discovered: number | null;
  /** When the perimeter was last mapped. */
  mapped: number | null;
  state: string | null;
  county: string | null;
  /** RX for a prescribed burn, WF for a wildfire. */
  kind: 'wildfire' | 'prescribed';
  cause: string | null;
}

type Raw = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon | null, Record<string, unknown>>;

const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const strOrNull = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const title = (s: string) => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

export function parsePerimeters(features: Raw[]): GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, PerimeterProps>[] {
  return features.flatMap(f => {
    const p = f.properties ?? {};
    if (!f.geometry) return [];
    const name = strOrNull(p.attr_IncidentName) ?? strOrNull(p.poly_IncidentName);
    const state = strOrNull(p.attr_POOState);
    return [{
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        id: strOrNull(p.attr_UniqueFireIdentifier) ?? strOrNull(p.poly_IRWINID) ?? String(f.id ?? name),
        name: name ? title(name) : 'Unnamed fire',
        acres: numOrNull(p.attr_IncidentSize) ?? numOrNull(p.poly_GISAcres),
        contained: numOrNull(p.attr_PercentContained),
        discovered: numOrNull(p.attr_FireDiscoveryDateTime),
        mapped: numOrNull(p.poly_DateCurrent) ?? numOrNull(p.poly_PolygonDateTime),
        state: state ? state.replace(/^US-/, '') : null,
        county: strOrNull(p.attr_POOCounty),
        kind: p.attr_IncidentTypeCategory === 'RX' ? 'prescribed' : 'wildfire',
        cause: strOrNull(p.attr_FireCause),
      },
    }];
  });
}

async function fetchAll(): Promise<Raw[]> {
  const all: Raw[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await httpJson<{ features?: Raw[]; exceededTransferLimit?: boolean; properties?: { exceededTransferLimit?: boolean } }>(
      wfigsUrl(page * PAGE), { timeoutMs: 30_000 });
    all.push(...(body.features ?? []));
    // GeoJSON replies carry the flag in `properties`; JSON ones at the top.
    if (!(body.exceededTransferLimit ?? body.properties?.exceededTransferLimit)) break;
  }
  return all;
}

const TTL_MS = 10 * 60_000;
let held: { at: number; features: ReturnType<typeof parsePerimeters> } | null = null;
let inflight: Promise<ReturnType<typeof parsePerimeters>> | null = null;

/** The current perimeters, cached for 10 minutes; the last good copy on failure, and empty when there are none. */
export function loadPerimeters(): Promise<ReturnType<typeof parsePerimeters>> {
  if (held && Date.now() - held.at < TTL_MS) return Promise.resolve(held.features);
  inflight ??= (async () => {
    try {
      held = { at: Date.now(), features: parsePerimeters(await fetchAll()) };
    } catch (e) {
      console.warn('[TAKIP] WFIGS perimeters failed:', e instanceof Error ? e.message : e);
    } finally {
      inflight = null;
    }
    return held?.features ?? [];
  })();
  return inflight;
}
