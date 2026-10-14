import { NextResponse } from 'next/server';
import { type ArticleSummary, articleRef, eventArticle, isArticleTitle, isDay } from '@/lib/history/wiki';
import { wikiLanguages, wikiSummary } from '@/lib/places/wikipedia';
import { getClientIp, isRateLimited } from '@/lib/ssrf-guard';
import { cachedSource } from '@/lib/sourceCache';

/**
 * TAKIP — the Wikipedia article for a history event: `?title=` ("fr:Titre" for another wiki) when the importer stored one, else found by
 * `?date=YYYY-MM-DD&lat=&lon=`. Asked from our server, so Wikimedia never sees the visitor.
 */

/** The language list is a nicety: the summary stands without it. */
async function article(ref: string): Promise<ArticleSummary | null> {
  const { lang, title } = articleRef(ref);
  const [summary, languages] = await Promise.all([wikiSummary(title, lang), wikiLanguages(title, lang).catch(() => [])]);
  return summary && { ...summary, ref, lang, languages };
}

const tooMany = () => NextResponse.json({ error: 'Too many lookups; try again in a minute' }, { status: 429 });

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const title = params.get('title');
  // Every popup with a stored title asks; the date-and-place search costs a Wikidata query, so it gets less.
  if (title !== null) {
    if (isRateLimited(`history-wiki-title:${getClientIp(req)}`, 120, 60_000)) return tooMany();
    if (!isArticleTitle(title)) return NextResponse.json({ error: 'Bad title' }, { status: 400 });
    const [found] = await cachedSource<{ summary: ArticleSummary | null }>(`history:article:${title}`, async () => [{ summary: await article(title) }], 7 * 24 * 3_600_000)();
    return reply(found);
  }
  if (isRateLimited(`history-wiki:${getClientIp(req)}`, 30, 60_000)) return tooMany();
  const day = params.get('date') ?? '';
  const lat = Number(params.get('lat')), lon = Number(params.get('lon'));
  if (!isDay(day) || !(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) {
    return NextResponse.json({ error: 'date, lat and lon are required' }, { status: 400 });
  }
  // Wrapped so "no article" is cached too: cachedSource treats an empty list as a failed fetch.
  const [found] = await cachedSource<{ summary: ArticleSummary | null }>(`history:article:${day}:${lat.toFixed(2)},${lon.toFixed(2)}`, async () => {
    const title = await eventArticle(day, lon, lat);
    return [{ summary: title ? await article(title) : null }];
  }, 7 * 24 * 3_600_000)();
  return reply(found);
}

function reply(found: { summary: ArticleSummary | null } | undefined) {
  if (!found) return NextResponse.json({ error: 'Wikipedia lookup failed' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  if (!found.summary) return NextResponse.json({ error: 'No article' }, { status: 404, headers: { 'Cache-Control': 'public, s-maxage=86400' } });
  return NextResponse.json(found.summary, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } });
}
