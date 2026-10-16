import { NextResponse } from 'next/server';
import { FUZZY_WITHIN_M, GEO_RADIUS_M, PLACE_KINDS, rankCandidates, SEARCH_MAX_KM, distanceKm, type PlaceKind } from '@/lib/places/labels/wiki';
import type { WikiSummary } from '@/lib/core/wikipedia/summary';
import { getClientIp, isRateLimited } from '@/lib/core/net/ssrf-guard';
import { cachedSource } from '@/lib/core/net/source-cache';
import { wikiGeosearch, wikiSearch, wikiSummary } from '@/lib/core/wikipedia/client';

/**
 * TAKIP — the Wikipedia article for a labelled place on the base map:
 * `?n=<name>` (repeatable, English first) `&lat=&lon=&kind=`. Asked from our
 * server, so Wikipedia never sees the visitor.
 */

async function resolve(names: string[], kind: PlaceKind, at: { lat: number; lon: number }): Promise<WikiSummary | null> {
  const tried = new Set<string>();
  const first = async (titles: string[]) => {
    for (const title of titles.slice(0, 3)) {
      if (tried.has(title)) continue;
      tried.add(title);
      const s = await wikiSummary(title);
      if (s) return s;
    }
    return null;
  };

  if (kind !== 'region') {
    const near = await first(rankCandidates(names, await wikiGeosearch(at.lat, at.lon, GEO_RADIUS_M[kind]), FUZZY_WITHIN_M[kind]));
    if (near) return near;
  }
  // Big places keep their article's pin far from the label, so search by name and check the distance.
  const hits = await wikiSearch(names[0]);
  const usable = kind === 'region'
    ? hits.map((h, i) => ({ title: h.title, dist: i }))
    : hits.filter(h => h.coord && distanceKm(at, h.coord) <= SEARCH_MAX_KM[kind]).map(h => ({ title: h.title, dist: distanceKm(at, h.coord!) }));
  return first(rankCandidates(names, usable));
}

export async function GET(req: Request) {
  if (isRateLimited(`map-wiki:${getClientIp(req)}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Too many lookups; try again in a minute' }, { status: 429 });
  }
  const params = new URL(req.url).searchParams;
  const names = params.getAll('n').map(n => n.trim().slice(0, 120)).filter(Boolean).slice(0, 4);
  const lat = Number(params.get('lat')), lon = Number(params.get('lon'));
  const kind = params.get('kind') as PlaceKind;
  if (!names.length || !PLACE_KINDS.includes(kind) || !(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) {
    return NextResponse.json({ error: 'n, lat, lon and kind are required' }, { status: 400 });
  }
  try {
    const key = `map:wiki:${kind}:${lat.toFixed(2)},${lon.toFixed(2)}:${names.join('|')}`;
    const [found] = await cachedSource<WikiSummary>(key, async () => {
      const s = await resolve(names, kind, { lat, lon });
      return s ? [s] : [];
    }, 24 * 3_600_000)();
    if (!found) return NextResponse.json({ error: 'No article' }, { status: 404, headers: { 'Cache-Control': 'public, s-maxage=3600' } });
    return NextResponse.json(found, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Wikipedia lookup failed' }, { status: 502 });
  }
}
