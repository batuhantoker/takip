import type { IpCandidate } from './consensus';
import { PROVIDERS } from './providers';

const TIMEOUT_MS = 3000;
const CACHE_MAX = 5000;
const FULL_TTL_MS = 6 * 60 * 60_000;
// Fewer answers usually means rate limits; ask again soon rather than keep a weak answer for hours.
const THIN_TTL_MS = 5 * 60_000;

const cache = new Map<string, { until: number; candidates: IpCandidate[] }>();

/** Every provider's answer for `ip` (null: the caller's own connection), asked at once and cached per address. */
export async function askProviders(ip: string | null): Promise<IpCandidate[]> {
  const key = ip ?? '';
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.candidates;

  const settled = await Promise.allSettled(PROVIDERS.map(async p => {
    const res = await fetch(p.url(ip), { signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store', headers: p.headers });
    const place = res.ok ? p.read(await res.json()) : null;
    return place ? { source: p.name, ...place } : null;
  }));
  const candidates = settled.flatMap(s => (s.status === 'fulfilled' && s.value ? [s.value] : []));

  if (candidates.length) {
    cache.delete(key);
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
    cache.set(key, { until: Date.now() + (candidates.length >= 3 ? FULL_TTL_MS : THIN_TTL_MS), candidates });
  }
  return candidates;
}

/** For tests. */
export function clearIpCache() {
  cache.clear();
}
