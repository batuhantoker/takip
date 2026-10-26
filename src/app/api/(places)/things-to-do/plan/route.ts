import { NextResponse } from 'next/server';
import { isLocale } from '@/lib/core/i18n/locales';
import { placeById } from '@/lib/platform/site/places/gazetteer';
import { PLANS, planFeatures, planWalks } from '@/lib/platform/site/places/topics/plans';

/**
 * GET /api/things-to-do/plan?place=<GeoNames id>&slug=<page slug>&lang=xx
 *
 * A place page's day plan (lib/platform/site/places/topics/plans.ts) as GeoJSON for the live map: each day's walk
 * along the streets with its length and minutes (straight where the router had none), a line between a country's
 * cities, and the stops numbered within their day and named in `lang`.
 */
export async function GET(req: Request) {
  const search = new URL(req.url).searchParams;
  const lang = search.get('lang') ?? 'en';
  if (!isLocale(lang)) return NextResponse.json({ error: 'Unknown lang' }, { status: 400 });
  const place = placeById(Number(search.get('place')));
  const page = place && PLANS.kinds.includes(place.kind) ? PLANS.pages(place).find(p => p.slug === search.get('slug')) : undefined;
  if (!page) return NextResponse.json({ error: 'No such plan' }, { status: 404 });
  return NextResponse.json(planFeatures(page.data, lang, await planWalks(page.data)), { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } });
}
