/**
 * TAKIP — Canadian wildfire incidents from the Canadian Wildland Fire
 * Information System (CWFIS, NRCan), no key. OGL-Canada.
 *
 * Agency-reported fires with size and stage of control: the incidents behind
 * FIRMS hotspots, not the hotspots themselves. The WFS layer keeps every past
 * version of every fire (~190k rows), so the query asks only for versions
 * current right now. Paging needs a sort key the layer lacks, so it is one
 * request; ~200 fires is a busy day. Geometry is EPSG:3978, so the
 * `latitude`/`longitude` properties are used instead.
 *
 * BC Wildfire Service's own feed (OGL-BC) is joined on for the fire's name,
 * incident page and "fire of note" flag; CWFIS has neither.
 */

export const CWFIS_WFS = 'https://geoserver.cwfif.nrcan.gc.ca/geoserver/ows';
export const BC_WFS = 'https://openmaps.gov.bc.ca/geo/pub/ows';

export interface FireIncident {
  id: string;
  name: string;
  agency: string;
  lat: number;
  lng: number;
  sizeHa: number | null;
  stage: 'OC' | 'BH' | 'UC';
  stageLabel: string;
  cause: string | null;
  updated?: string;
  ofNote?: boolean;
  url: string;
  provider: 'CWFIS';
}

const STAGES: Record<FireIncident['stage'], string> = { OC: 'Out of control', BH: 'Being held', UC: 'Under control' };
const CAUSES: Record<string, string> = { N: 'Natural', H: 'Human', U: 'Undetermined' };
const AGENCIES: Record<string, string> = {
  BC: 'British Columbia', AB: 'Alberta', SK: 'Saskatchewan', MB: 'Manitoba', ON: 'Ontario', QC: 'Quebec',
  NB: 'New Brunswick', NS: 'Nova Scotia', PE: 'Prince Edward Island', NL: 'Newfoundland and Labrador',
  YT: 'Yukon', NT: 'Northwest Territories', NU: 'Nunavut', PC: 'Parks Canada',
};

export function cwfisUrl(now: Date): string {
  const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const filter = `record_start <= '${at}' AND record_end > '${at}' AND fire_was_prescribed <> 1`;
  return `${CWFIS_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=public:cwfif_national_activefires`
    + `&outputFormat=application/json&count=5000&CQL_FILTER=${encodeURIComponent(filter)}`;
}

export function bcUrl(): string {
  const fields = 'FIRE_NUMBER,FIRE_STATUS,INCIDENT_NAME,GEOGRAPHIC_DESCRIPTION,FIRE_URL,FIRE_OF_NOTE_IND';
  return `${BC_WFS}?service=WFS&request=GetFeature&typeNames=pub:WHSE_LAND_AND_NATURAL_RESOURCE.PROT_CURRENT_FIRE_PNTS_SP`
    + `&outputFormat=application/json&propertyName=${fields}&CQL_FILTER=${encodeURIComponent("FIRE_STATUS <> 'Out'")}`;
}

function features(json: unknown, who: string): { properties?: Record<string, unknown> }[] {
  const fs = (json as { features?: unknown } | null)?.features;
  if (!Array.isArray(fs)) throw new Error(`${who}: unexpected WFS shape`);
  return fs;
}

export interface BcFire {
  name: string;
  url: string;
  ofNote: boolean;
}

/** FIRE_NUMBER → name, incident page and fire-of-note flag. */
export function parseBcFires(json: unknown): Map<string, BcFire> {
  const out = new Map<string, BcFire>();
  for (const { properties: p } of features(json, 'BC Wildfire')) {
    const num = typeof p?.FIRE_NUMBER === 'string' ? p.FIRE_NUMBER : '';
    if (!num) continue;
    const incident = String(p?.INCIDENT_NAME ?? '').trim();
    const where = String(p?.GEOGRAPHIC_DESCRIPTION ?? '').trim();
    out.set(num, {
      name: incident && incident !== num ? incident : where,
      url: typeof p?.FIRE_URL === 'string' ? p.FIRE_URL : '',
      ofNote: p?.FIRE_OF_NOTE_IND === 'Y',
    });
  }
  return out;
}

export function parseCwfis(json: unknown, bc: Map<string, BcFire> = new Map()): FireIncident[] {
  return features(json, 'CWFIS').flatMap(({ properties: p }) => {
    const stage = String(p?.stage_of_control_status ?? '') as FireIncident['stage'];
    const lat = typeof p?.latitude === 'number' ? p.latitude : NaN;
    const lng = typeof p?.longitude === 'number' ? p.longitude : NaN;
    const id = String(p?.national_fire_id ?? '');
    if (!id || !(stage in STAGES) || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];

    const agencyCode = String(p?.agency_code ?? '');
    const agencyId = String(p?.agency_fire_id ?? '');
    // CWFIS prefixes BC fire numbers with the year: "2026-C40983".
    const bcFire = agencyCode === 'BC' ? bc.get(agencyId.replace(/^\d{4}-/, '')) : undefined;
    const size = Number(p?.fire_size);
    return [{
      id,
      name: bcFire?.name || agencyId || id,
      agency: AGENCIES[agencyCode] ?? agencyCode,
      lat,
      lng,
      sizeHa: Number.isFinite(size) && size >= 0 ? size : null,
      stage,
      stageLabel: STAGES[stage],
      cause: CAUSES[String(p?.national_fire_cause ?? '')] ?? null,
      updated: typeof p?.status_date === 'string' ? p.status_date : undefined,
      ofNote: bcFire?.ofNote || undefined,
      url: bcFire?.url || 'https://cwfis.cfs.nrcan.gc.ca/interactive-map',
      provider: 'CWFIS',
    }];
  });
}
