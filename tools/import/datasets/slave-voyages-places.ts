import { GeoPrec } from '@takip/db';
import type { GeoIndex } from '../geo/geo-index';
import { resolveEvent } from '../geo/resolve';

/*
 * SlaveVoyages' places: numeric codes in the voyage files, with the coordinates the site's own maps use (its API's
 * place tree). Where the site has none, the place's name goes to the resolver, then its region's point stands in.
 */

export type TreeNode = { name: string; longitude: number | null; latitude: number | null; value: number; location_type: { name: string }; children?: TreeNode[] };

export type SvNode = { code: number; name: string; lon: number | null; lat: number | null; type: 'Place' | 'Region' | 'Broad Region'; region?: SvNode; broad?: SvNode; countries?: string[] };

/** The site's tree, flattened by code, each node knowing its region and broad region. */
export function placeTable(tree: TreeNode[]): Map<number, SvNode> {
  const out = new Map<number, SvNode>();
  const walk = (n: TreeNode, region?: SvNode, broad?: SvNode) => {
    const type = n.location_type.name as SvNode['type'];
    const node: SvNode = { code: n.value, name: n.name.trim(), lon: n.longitude, lat: n.latitude, type, region, broad };
    out.set(n.value, node);
    for (const c of n.children ?? []) walk(c, type === 'Region' ? node : region, type === 'Broad Region' ? node : broad);
  };
  for (const n of tree) walk(n);
  return out;
}

/**
 * Codes the downloads use that the site's tree doesn't: names from the 2020 SPSS file's value labels. Its "Other"
 * places moved from 80xxx to 90xxx after these files were made (80xxx is Asia now), except India's, which went.
 */
const MISSING: Record<number, { name: string; parent?: number; countries?: string[] }> = {
  39002: { name: 'West Indies (colony unspecified)', parent: 39000 },
  43000: { name: 'Peru', parent: 40000, countries: ['PE'] },
  43001: { name: 'Lima', parent: 43000, countries: ['PE'] },
  80300: { name: 'Asia e Africa', parent: 90000 },
  80399: { name: 'Asia e Africa, port unspecified', parent: 90000 },
  80601: { name: 'Bengal', countries: ['IN', 'BD'] },
  80602: { name: 'Goa', countries: ['IN'] },
  80603: { name: 'Calcutta', countries: ['IN'] },
  80604: { name: 'Basse Indre', countries: ['FR'] },
};

export const apiCode = (code: number) => ((code >= 80000 && code < 80300) || (code >= 80400 && code < 80600) || (code >= 80700 && code < 80800) ? code + 10000 : code);

/** The node for a code in the downloads; MISSING wins, since the site reused some of those codes (80603 is Macau now). */
export function lookup(table: Map<number, SvNode>, code: number): SvNode | undefined {
  const m = MISSING[code];
  if (!m) return table.get(apiCode(code));
  const parent = m.parent !== undefined ? (table.get(m.parent) ?? lookup(table, m.parent)) : undefined;
  const region = parent?.type === 'Region' ? parent : parent?.region;
  const broad = parent?.type === 'Broad Region' ? parent : parent?.broad;
  return { code, name: m.name, lon: null, lat: null, type: m.parent === undefined || parent?.type === 'Region' ? 'Place' : 'Region', region, broad, countries: m.countries };
}

/** Resolver context for the regions that hold places the site gives no coordinates. */
const REGION_CODES: Record<string, string[]> = {
  Hispaniola: ['DO', 'HT'], Cuba: ['CU'], Georgia: ['US'], Virginia: ['US'], 'New York': ['US'], Pennsylvania: ['US'], Delaware: ['US'], Florida: ['US'],
  'Senegambia and offshore Atlantic': ['SN', 'GM', 'GW', 'MR', 'CV', 'ML'], 'Sierra Leone': ['SL', 'GN'], 'Windward Coast': ['LR', 'CI', 'SL', 'GN'],
  'Gold Coast': ['GH'], 'Bight of Benin': ['TG', 'BJ', 'NG'], 'Bight of Biafra and Gulf of Guinea islands': ['NG', 'CM', 'GQ', 'ST', 'GA'],
  'West Central Africa and St. Helena': ['AO', 'CD', 'CG', 'GA', 'SH'], 'East Africa and Indian Ocean islands': ['MZ', 'TZ', 'KE', 'MG', 'KM', 'MU', 'RE', 'SC', 'SO', 'YT'],
  Amazonia: ['BR'], Bahia: ['BR'], Pernambuco: ['BR'], 'Southeast Brazil': ['BR'], 'Rio de la Plata': ['AR', 'UY', 'PY'],
  'Insular Southeast Asia': ['ID', 'MY', 'PH', 'TL', 'BN', 'SG', 'VN'], 'South Asia': ['IN', 'BD', 'LK', 'PK', 'MM'],
};
/** Regions whose names are first-level divisions today, so they narrow a name further. */
const ADMIN1_REGIONS = new Set(['Georgia', 'Virginia', 'New York', 'Pennsylvania', 'Delaware', 'Florida', 'Bahia', 'Pernambuco']);

const hasPoint = (n: SvNode | undefined): n is SvNode & { lon: number; lat: number } =>
  !!n && n.lon !== null && n.lat !== null && Number.isFinite(n.lon) && Number.isFinite(n.lat) && !(n.lon === 0 && n.lat === 0);

/** "Other Africa" and the like, and the "Other" broad region, hold catch-alls and composites, not one area. */
const catchAll = (n: SvNode | undefined) => !!n && (/^other\b/i.test(n.name) || n.broad?.name === 'Other');
const VAGUE = /unspecified|undetermined|unknown/i;
const COMPOSITE = /\s\+\s|\s(?:or|and|to)\s|,.*,/i;
const NOWHERE = new Set(['Non-geographical']);
/** A named stretch rather than a port: the Congo River, the Cape Verde Islands, the Ivory Coast. */
const STRETCH = /\b(?:islands|isles|ilhas|coast|côte|costa|rivers?|rio|estuary|lagoon|bay|gulf|north|south|guinea)\b/i;

export type Nature = 'named' | 'stretch' | 'region' | 'broad' | 'nowhere';

export function nature(n: SvNode): Nature {
  if (n.name.includes('???') || NOWHERE.has(n.region?.name ?? '') || NOWHERE.has(n.name)) return 'nowhere';
  if (n.type === 'Broad Region') return 'broad';
  if (n.type === 'Region') return catchAll(n) ? 'broad' : 'region';
  if (VAGUE.test(n.name) || COMPOSITE.test(n.name)) return catchAll(n.region) || catchAll(n) ? 'broad' : 'region';
  return STRETCH.test(n.name) && !/\b(?:castle|fort)\b/i.test(n.name) ? 'stretch' : 'named';
}

/** "San Domingo (a) Santo Domingo", "Whydah, Ouidah", "Vatt (location undetermined)": each name the site gives. */
export function spellings(name: string): string[] {
  const parts = name.split(/\s+\(a\)\s+|,\s*/).map(x => x.replace(/\s*\([^)]*\)\s*/g, ' ').trim()).filter(Boolean);
  return [...new Set(parts)];
}

const PREC: Record<Exclude<Nature, 'nowhere'>, GeoPrec> = { named: GeoPrec.city, stretch: GeoPrec.area, region: GeoPrec.approximate, broad: GeoPrec.country };

export type SvPlace = { lon: number; lat: number; geoPrec: GeoPrec; method: 'slavevoyages' | 'resolver' | 'slavevoyages-region'; name: string; placedAt: string; confidence?: number };

/** Where a code is, best evidence first, or null when nothing places it. `role` names it in placed_at ("principal place of purchase"). */
export function locate(geo: GeoIndex | null, n: SvNode | undefined, role: string): SvPlace | null {
  if (!n) return null;
  const kind = nature(n);
  if (kind === 'nowhere') return null;
  if (hasPoint(n)) {
    const placedAt = kind === 'named' || kind === 'stretch'
      ? `${role}, ${n.name} (SlaveVoyages’ coordinates)`
      : `point SlaveVoyages gives for “${n.name}”${kind === 'broad' ? ': the source records no port or region' : ''}`;
    return { lon: n.lon, lat: n.lat, geoPrec: PREC[kind], method: 'slavevoyages', name: n.name, placedAt };
  }
  const countries = n.countries ?? REGION_CODES[n.region?.name ?? ''];
  if (geo && (kind === 'named' || kind === 'stretch') && countries) {
    const admin1 = n.region && ADMIN1_REGIONS.has(n.region.name) ? n.region.name : null;
    const r = spellings(n.name)
      .map(name => resolveEvent(geo, { named: [{ name, admin1 }], countries }, { methods: ['named-place'] }))
      // A lone namesake abroad (the Liverpool River in Australia) is not the place.
      .find(x => x?.evidence?.some(e => e === 'country' || e === 'admin1'));
    if (r) {
      return {
        lon: r.lon, lat: r.lat, geoPrec: r.geoPrec, method: 'resolver', name: n.name, confidence: r.confidence,
        placedAt: `${role}, ${n.name}, found by name in the gazetteer (SlaveVoyages gives no coordinates for it)`,
      };
    }
  }
  for (const up of [n.region, n.broad]) {
    if (!hasPoint(up)) continue;
    const broad = up.type === 'Broad Region' || catchAll(up);
    return {
      lon: up.lon, lat: up.lat, geoPrec: broad ? GeoPrec.country : GeoPrec.approximate, method: 'slavevoyages-region', name: n.name,
      placedAt: `point SlaveVoyages gives for its ${broad ? 'broad region' : 'region'}, ${up.name} (it has no coordinates for “${n.name}”)`,
    };
  }
  return null;
}
