import { cachedSource } from './source-cache';

/**
 * TAKIP — UNHCR displacement per country from the population API, no key. CC BY 4.0 (verify), credit UNHCR.
 * Annual and a year or more behind: the newest year may be unpublished, so it falls back one year.
 */

const API = 'https://api.unhcr.org/population/v1';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
const DAY_MS = 24 * 3600_000;

export interface Displacement {
  iso2: string;
  year: number;
  /** People who fled this country, as refugees or asylum seekers elsewhere. */
  refugees_from: number;
  asylum_seekers_from: number;
  /** Displaced inside their own country. */
  idps: number;
  /** People from elsewhere sheltering here. */
  refugees_hosted: number;
  asylum_seekers_hosted: number;
  source: 'UNHCR';
  url: string;
}

interface Row {
  year?: number;
  coo_iso?: string;
  coa_iso?: string;
  refugees?: number | string;
  asylum_seekers?: number | string;
  idps?: number | string;
}

interface CountryRow { iso?: string | null; iso2?: string | null }

/** The API mixes numbers and strings ("0", "-"). */
const count = (v: unknown): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function buildDisplacement(countries: CountryRow[], origin: Row[], asylum: Row[], year: number): Displacement[] {
  const iso2Of = new Map(countries.filter(c => c.iso && c.iso2).map(c => [c.iso as string, (c.iso2 as string).toUpperCase()]));
  const byIso2 = new Map<string, Displacement>();
  const entry = (iso3: string | undefined) => {
    const iso2 = iso3 && iso2Of.get(iso3);
    if (!iso2) return null;
    let d = byIso2.get(iso2);
    if (!d) {
      d = {
        iso2, year, refugees_from: 0, asylum_seekers_from: 0, idps: 0, refugees_hosted: 0, asylum_seekers_hosted: 0,
        source: 'UNHCR', url: 'https://www.unhcr.org/refugee-statistics/',
      };
      byIso2.set(iso2, d);
    }
    return d;
  };
  for (const r of origin) {
    const d = entry(r.coo_iso);
    if (!d) continue;
    d.refugees_from += count(r.refugees);
    d.asylum_seekers_from += count(r.asylum_seekers);
    d.idps += count(r.idps);
  }
  for (const r of asylum) {
    const d = entry(r.coa_iso);
    if (!d) continue;
    d.refugees_hosted += count(r.refugees);
    d.asylum_seekers_hosted += count(r.asylum_seekers);
  }
  return [...byIso2.values()];
}

async function items<T>(path: string): Promise<T[]> {
  const res = await fetch(`${API}${path}`, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`UNHCR HTTP ${res.status}`);
  const json = await res.json() as { items?: unknown };
  if (!Array.isArray(json.items)) throw new Error('UNHCR: unexpected response');
  return json.items as T[];
}

const loadTable = cachedSource<Displacement>('unhcr:displacement', async () => {
  const countries = await items<CountryRow>('/countries/?limit=400');
  const latest = new Date().getUTCFullYear() - 1;
  for (const year of [latest, latest - 1]) {
    const range = `limit=1000&yearFrom=${year}&yearTo=${year}`;
    const [origin, asylum] = await Promise.all([
      items<Row>(`/population/?${range}&coo_all=true`),
      items<Row>(`/population/?${range}&coa_all=true`),
    ]);
    if (origin.length && asylum.length) return buildDisplacement(countries, origin, asylum, year);
  }
  throw new Error('UNHCR has published neither of the last two years');
}, DAY_MS);

/** null when the table loaded but has no row for the country; throws when it could not be loaded. */
export async function displacementFor(iso2: string): Promise<Displacement | null> {
  const table = await loadTable();
  if (!table.length) throw new Error('UNHCR table unavailable');
  return table.find(d => d.iso2 === iso2.toUpperCase()) ?? null;
}
