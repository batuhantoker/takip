import { cachedSource } from './source-cache';

/**
 * TAKIP — street-level crime within a mile, latest published month, from data.police.uk; no key, OGL v3.
 * England, Wales and Northern Ireland only, about two months behind, reported crime only, and each point is
 * snapped to an anonymised location. An empty answer is "no data here", never "no crime".
 */

const API = 'https://data.police.uk/api/crimes-street/all-crime';
const SIX_HOURS = 6 * 3600_000;

export interface StreetCrime {
  month: string;
  total: number;
  top: { category: string; label: string; count: number }[];
  radius_miles: 1;
  source: 'data.police.uk';
  url: string;
}

const label = (slug: string) => {
  const words = slug.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export function summariseCrimes(rows: unknown): StreetCrime | null {
  if (!Array.isArray(rows)) throw new Error('data.police.uk: unexpected response');
  const counts = new Map<string, number>();
  let month = '';
  for (const r of rows as { category?: unknown; month?: unknown }[]) {
    if (typeof r?.category !== 'string') continue;
    counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
    if (typeof r.month === 'string' && r.month > month) month = r.month;
  }
  if (!counts.size) return null;
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([category, count]) => ({ category, label: label(category), count }));
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return { month, total, top, radius_miles: 1, source: 'data.police.uk', url: 'https://data.police.uk/' };
}

/** null outside coverage; throws when the API fails. */
export async function streetCrimeNear(lat: number, lng: number): Promise<StreetCrime | null> {
  const at = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  // Cached as a one-row list; [] is the "no data here" answer.
  const rows = await cachedSource<StreetCrime>(`police-uk:${at}`, async () => {
    const res = await fetch(`${API}?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}`, {
      headers: { 'User-Agent': 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)', Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    });
    // 503 is the API's "more than 10,000 crimes" answer.
    if (!res.ok) throw new Error(`data.police.uk HTTP ${res.status}`);
    const summary = summariseCrimes(await res.json());
    return summary ? [summary] : [];
  }, SIX_HOURS)();
  return rows[0] ?? null;
}
