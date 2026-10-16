/**
 * Wikipedia lookups for server routes, English unless a wiki code is given. Keyless; Wikimedia asks for a
 * descriptive User-Agent and a gentle request rate.
 */
import { trimExtract, type WikiSummary } from './summary';

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

/** A wiki code goes into the host name, so nothing but a code passes. */
const wikiHost = (lang: string) => {
  if (!/^[a-z][a-z0-9-]{1,15}$/.test(lang)) throw new Error(`bad wiki code ${lang}`);
  return `https://${lang}.wikipedia.org`;
};

/** An article's lead and picture; null when it is missing or a disambiguation page. `lang` is a wiki code ("fr"). */
export async function wikiSummary(title: string, lang = 'en'): Promise<WikiSummary | null> {
  const api = wikiHost(lang);
  const res = await fetch(`${api}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Wikipedia summary HTTP ${res.status}`);
  const s = await res.json() as { type?: string; title: string; description?: string; extract?: string; thumbnail?: { source: string; width: number; height: number }; content_urls?: { desktop?: { page?: string } } };
  if (s.type === 'disambiguation') return null;
  return {
    title: s.title,
    description: s.description ?? null,
    extract: trimExtract(s.extract ?? ''),
    image: s.thumbnail ? { src: s.thumbnail.source, width: s.thumbnail.width, height: s.thumbnail.height } : null,
    url: s.content_urls?.desktop?.page ?? `${api}/wiki/${encodeURIComponent(s.title)}`,
  };
}

/** The same article in the other Wikipedias, as [{ lang, title }]. */
export async function wikiLanguages(title: string, lang = 'en'): Promise<{ lang: string; title: string }[]> {
  const params = { action: 'query', format: 'json', formatversion: '2', prop: 'langlinks', lllimit: 'max', redirects: '1', titles: title };
  const body = await getJson<{ query?: { pages?: { langlinks?: { lang: string; title: string }[] }[] } }>(`${wikiHost(lang)}/w/api.php?${new URLSearchParams(params)}`);
  return body.query?.pages?.[0]?.langlinks ?? [];
}
