import { NextResponse } from 'next/server';
import { cachedSource } from '@/lib/core/net/source-cache';
import { wikiInLanguage, wikiSearch, wikiSummary } from '@/lib/core/wikipedia/client';
import type { WikiArticle, WikiSummary } from '@/lib/core/wikipedia/summary';

/**
 * TAKIP — a Wikipedia article's lead and picture for something in the space
 * view: `?title=` names the English article, `?q=` searches English Wikipedia
 * for it first, and `&lang=`, the reader's Wikipedia, shows it from there when
 * that has the article. Keyless.
 */

const DAY_MS = 24 * 3_600_000;

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const title = params.get('title')?.slice(0, 200) ?? '', q = params.get('q')?.slice(0, 200) ?? '';
  const lang = /^[a-z][a-z0-9-]{1,15}$/.test(params.get('lang') ?? '') ? params.get('lang')! : 'en';
  if (!title && !q) return NextResponse.json({ error: 'title or q' }, { status: 400 });
  const [found] = await cachedSource<WikiSummary>(`space:wiki:${title}|${q}`, async () => {
    const name = title || (await wikiSearch(q, 1))[0]?.title;
    const s = name ? await wikiSummary(name) : null;
    return s ? [s] : [];
  }, DAY_MS)();
  if (!found) return NextResponse.json({ error: 'No article' }, { status: 404, headers: { 'Cache-Control': 'public, s-maxage=3600' } });
  const [article] = await cachedSource<WikiArticle>(`space:wiki:${lang}:${found.title}`, async () => [await wikiInLanguage(found, lang)], DAY_MS)();
  return NextResponse.json(article ?? { ...found, lang: 'en' }, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } });
}
