import { NextResponse } from 'next/server';
import { articleRef, isArticleTitle, wikiRef } from '@/lib/core/wikipedia/refs';
import { type ArticleSummary, eventArticle, isDay } from '@/lib/history/wiki';
import { wikiLanguages, wikiSummary } from '@/lib/core/wikipedia/client';
import { getClientIp, isRateLimited } from '@/lib/core/net/ssrf-guard';
import { cachedSource } from '@/lib/core/net/source-cache';

/**
 * TAKIP — the Wikipedia article for a history event: `?title=` ("fr:Titre" for another wiki) when the importer stored one, else found by
 * `?date=YYYY-MM-DD&lat=&lon=`. `&lang=` is the reader's Wikipedia, used when it has the article. Asked from our server, so Wikimedia
 * never sees the visitor.
 */

/** The language list is a nicety: the summary stands without it. */
async function article(ref: string, prefer: string | null): Promise<ArticleSummary | null> {
  const { lang, title } = articleRef(ref);
  const [summary, languages] = await Promise.all([wikiSummary(title, lang), wikiLanguages(title, lang).catch(() => [])]);
  const there = prefer && prefer !== lang ? languages.find(l => l.lang === prefer) : undefined;
  const preferred = there && await wikiSummary(there.title, there.lang).catch(() => null);
  if (there && preferred) return { ...preferred, ref: wikiRef(there.lang, there.title), lang: there.lang, languages: [{ lang, title }, ...languages.filter(l => l !== there)] };
  return summary && { ...summary, ref, lang, languages };
}

const tooMany = () => NextResponse.json({ error: 'Too many lookups; try again in a minute' }, { status: 429 });

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const title = params.get('title');
  const prefer = /^[a-z][a-z0-9-]{1,15}$/.test(params.get('lang') ?? '') ? params.get('lang') : null;
  // Every popup with a stored title asks; the date-and-place search costs a Wikidata query, so it gets less.
  if (title !== null) {
    if (isRateLimited(`history-wiki-title:${getClientIp(req)}`, 120, 60_000)) return tooMany();
    if (!isArticleTitle(title)) return NextResponse.json({ error: 'Bad title' }, { status: 400 });
    const [found] = await cachedSource<{ summary: ArticleSummary | null }>(`history:article:${title}:${prefer ?? ''}`, async () => [{ summary: await article(title, prefer) }], 7 * 24 * 3_600_000)();
    return reply(found);
  }
  if (isRateLimited(`history-wiki:${getClientIp(req)}`, 30, 60_000)) return tooMany();
  const day = params.get('date') ?? '';
  const lat = Number(params.get('lat')), lon = Number(params.get('lon'));
  if (!isDay(day) || !(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) {
    return NextResponse.json({ error: 'date, lat and lon are required' }, { status: 400 });
  }
  // Wrapped so "no article" is cached too: cachedSource treats an empty list as a failed fetch.
  const [found] = await cachedSource<{ summary: ArticleSummary | null }>(`history:article:${day}:${lat.toFixed(2)},${lon.toFixed(2)}:${prefer ?? ''}`, async () => {
    const title = await eventArticle(day, lon, lat);
    return [{ summary: title ? await article(title, prefer) : null }];
  }, 7 * 24 * 3_600_000)();
  return reply(found);
}

function reply(found: { summary: ArticleSummary | null } | undefined) {
  if (!found) return NextResponse.json({ error: 'Wikipedia lookup failed' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  if (!found.summary) return NextResponse.json({ error: 'No article' }, { status: 404, headers: { 'Cache-Control': 'public, s-maxage=86400' } });
  return NextResponse.json(found.summary, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } });
}
