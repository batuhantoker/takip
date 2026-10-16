import { NextResponse } from 'next/server';
import { cachedSource } from '@/lib/core/net/source-cache';
import { trimExtract, type WikiSummary } from '@/lib/core/wikipedia/summary';

/**
 * TAKIP — a Wikipedia article's lead and picture for something in the space
 * view: `?title=` names the article, `?q=` searches for it first. Keyless; the
 * Wikimedia API asks for a descriptive User-Agent.
 */

const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
const API = 'https://en.wikipedia.org';

async function search(q: string): Promise<string | null> {
  const url = `${API}/w/api.php?${new URLSearchParams({ action: 'query', list: 'search', srsearch: q, srlimit: '1', format: 'json' })}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Wikipedia search HTTP ${res.status}`);
  const body = await res.json() as { query?: { search?: { title: string }[] } };
  return body.query?.search?.[0]?.title ?? null;
}

async function summary(title: string): Promise<WikiSummary | null> {
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

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const title = params.get('title')?.slice(0, 200) ?? '', q = params.get('q')?.slice(0, 200) ?? '';
  if (!title && !q) return NextResponse.json({ error: 'title or q' }, { status: 400 });
  const [found] = await cachedSource<WikiSummary>(`space:wiki:${title}|${q}`, async () => {
    const name = title || await search(q);
    const s = name ? await summary(name) : null;
    return s ? [s] : [];
  }, 24 * 3_600_000)();
  if (!found) return NextResponse.json({ error: 'No article' }, { status: 404, headers: { 'Cache-Control': 'public, s-maxage=3600' } });
  return NextResponse.json(found, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } });
}
