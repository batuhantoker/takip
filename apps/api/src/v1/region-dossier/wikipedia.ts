export interface WikipediaSummary { title: string; extract?: string; thumbnail?: string }

/** The article's lead, cut to 500 characters, with its thumbnail; null when there is none or the fetch fails. */
export async function wikipediaSummary(title: string): Promise<WikipediaSummary | null> {
  if (!title) return null;
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const wiki = (await res.json()) as { title: string; extract?: string; thumbnail?: { source?: string } };
      return {
        title: wiki.title,
        extract: wiki.extract?.substring(0, 500),
        thumbnail: wiki.thumbnail?.source,
      };
    }
  } catch (e) { console.warn('[TAKIP] Wikipedia fetch error:', e instanceof Error ? e.message : e); }
  return null;
}
