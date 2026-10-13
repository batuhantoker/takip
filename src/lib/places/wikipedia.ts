/**
 * English Wikipedia lookups for server routes. Keyless; Wikimedia asks for a
 * descriptive User-Agent and a gentle request rate.
 */
import { trimExtract, type WikiSummary } from '@/lib/space/wiki-topic';

const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
const API = 'https://en.wikipedia.org';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Wikipedia HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

const action = (params: Record<string, string>) =>
  `${API}/w/api.php?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;

/** Articles with coordinates within `radiusM` (≤ 10 km), nearest first. */
export async function wikiGeosearch(lat: number, lon: number, radiusM: number, limit = 40): Promise<{ title: string; dist: number }[]> {
  const body = await getJson<{ query?: { geosearch?: { title: string; dist: number }[] } }>(action({
    action: 'query', list: 'geosearch', gscoord: `${lat}|${lon}`, gsradius: String(Math.min(10_000, radiusM)), gslimit: String(limit),
  }));
  return body.query?.geosearch ?? [];
}

/** The top search hits for `q`, in rank order, with their coordinates where the article has some. */
export async function wikiSearch(q: string, limit = 3): Promise<{ title: string; coord: { lat: number; lon: number } | null }[]> {
  const body = await getJson<{ query?: { pages?: { title: string; index: number; coordinates?: { lat: number; lon: number }[] }[] } }>(action({
    action: 'query', generator: 'search', gsrsearch: q, gsrlimit: String(limit), prop: 'coordinates',
  }));
  return (body.query?.pages ?? [])
    .sort((a, b) => a.index - b.index)
    .map(p => ({ title: p.title, coord: p.coordinates?.[0] ? { lat: p.coordinates[0].lat, lon: p.coordinates[0].lon } : null }));
}

/** An article's lead and picture; null when it is missing or a disambiguation page. */
export async function wikiSummary(title: string): Promise<WikiSummary | null> {
  const res = await fetch(`${API}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Wikipedia summary HTTP ${res.status}`);
  const s = await res.json() as { type?: string; title: string; description?: string; extract?: string; thumbnail?: { source: string; width: number; height: number }; content_urls?: { desktop?: { page?: string } } };
  if (s.type === 'disambiguation') return null;
  return {
    title: s.title,
    description: s.description ?? null,
    extract: trimExtract(s.extract ?? ''),
    image: s.thumbnail ? { src: s.thumbnail.source, width: s.thumbnail.width, height: s.thumbnail.height } : null,
    url: s.content_urls?.desktop?.page ?? `${API}/wiki/${encodeURIComponent(s.title)}`,
  };
}
