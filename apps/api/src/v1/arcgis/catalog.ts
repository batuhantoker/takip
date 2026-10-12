import type { ArcgisItem } from './schemas';

const SEARCH_URL = 'https://www.arcgis.com/sharing/rest/search';

/** What the catalogue search sends as is: the matches, or an error with its status. */
export type CatalogAnswer = { results: ArcgisItem[] } | { error: string; status: number };

interface SearchItem {
  id: string;
  title: string;
  url: string | null;
  snippet?: string | null;
  owner: string;
  numViews?: number;
  extent: number[][];
  tags?: string[];
}

async function fetchWithRetry(url: string, attempts = 2): Promise<Response> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, { signal: AbortSignal.timeout(20000) });
    } catch (e) {
      if (i === attempts - 1) throw e;
    }
  }
  throw new Error('All retries exhausted');
}

/** Public Feature Services in the ArcGIS Online catalogue matching q, inside bbox when given. */
export async function searchCatalog(q: string, bbox: string | undefined): Promise<CatalogAnswer> {
  try {
    const params = new URLSearchParams({ q, type: 'Feature Service', filter: 'access:public', num: '20', f: 'json' });
    if (bbox) params.set('bbox', bbox);

    const res = await fetchWithRetry(`${SEARCH_URL}?${params.toString()}`);
    if (!res.ok) return { error: `ArcGIS search failed (${res.status})`, status: res.status };

    const data = (await res.json()) as { results?: SearchItem[]; error?: { message?: string } };
    if (data.error) return { error: data.error.message || 'ArcGIS error', status: 502 };

    return {
      results: (data.results || []).map(item => ({
        id: item.id,
        title: item.title,
        url: item.url,
        snippet: item.snippet || '',
        owner: item.owner,
        numViews: item.numViews ?? 0,
        extent: item.extent,
        tags: item.tags || [],
      })),
    };
  } catch (err) {
    const { name, message } = (err ?? {}) as Partial<Error>;
    if (name === 'TimeoutError' || name === 'AbortError') return { error: 'ArcGIS search timed out', status: 504 };
    return { error: message || 'Search failed', status: 500 };
  }
}
